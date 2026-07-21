import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";

import { BadRequestException, HttpException, HttpStatus, Injectable, OnModuleDestroy } from "@nestjs/common";

import { Redis } from "ioredis";

import { IssueProofOfWorkChallengeResponseDto } from "./dto/issue-proof-of-work-challenge-response.dto";
import { ProofOfWorkAction } from "./proof-of-work-action.enum";
import { isProofOfWorkResult } from "./proof-of-work-result.interface";

import { ConfigService } from "../config/config.service";
import { MetricsService } from "../metrics/metrics.service";
import { RedisService } from "../redis/redis.service";

const CHALLENGE_EXPIRATION_SECONDS = 5 * 60;
const CHALLENGE_ISSUE_RATE_LIMIT = 20;
const CHALLENGE_ISSUE_RATE_LIMIT_WINDOW_SECONDS = 10;
const REDIS_KEY_CHALLENGE_PREFIX = "proof-of-work:challenge:";
const REDIS_KEY_ISSUE_RATE_LIMIT_PREFIX = "proof-of-work:issue-rate-limit:";

const TAKE_REDIS_VALUE_SCRIPT = `
local value = redis.call("GET", KEYS[1])
if value then
  redis.call("DEL", KEYS[1])
end
return value
`;

const INCREMENT_RATE_LIMIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return count
`;

interface RequestBinding {
  remoteIp: string;
  sessionId?: number;
  userId?: number;
}

interface ChallengeRecord extends RequestBinding {
  action: ProofOfWorkAction;
  difficulty: number;
  expiresAt: number;
  issuedAt: number;
  randomData: string;
}

const EXPENSIVE_ACTIONS = new Set<ProofOfWorkAction>([
  ProofOfWorkAction.PrepareSubmissionFileUpload,
  ProofOfWorkAction.SubmitProblem,
  ProofOfWorkAction.AcquireTencentCaptcha
]);

@Injectable()
export class ProofOfWorkService implements OnModuleDestroy {
  private readonly redis: Redis;

  private readonly metricSolveTime = this.metricsService.histogram(
    "libreoj_proof_of_work_solve_time_seconds",
    this.metricsService.histogram.BUCKETS_TIME_10M_30,
    ["action", "difficulty"] as const
  );

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    redisService: RedisService
  ) {
    this.redis = redisService.getClient();
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  async issueChallenge(
    action: ProofOfWorkAction,
    binding: RequestBinding
  ): Promise<IssueProofOfWorkChallengeResponseDto> {
    const rateLimitIdentities = [`ip:${createHash("sha256").update(binding.remoteIp).digest("hex")}`];
    if (binding.userId !== undefined) rateLimitIdentities.push(`user:${binding.userId}`);
    const counters = await Promise.all(
      rateLimitIdentities.map(identity =>
        this.redis.eval(
          INCREMENT_RATE_LIMIT_SCRIPT,
          1,
          `${REDIS_KEY_ISSUE_RATE_LIMIT_PREFIX}${identity}`,
          CHALLENGE_ISSUE_RATE_LIMIT_WINDOW_SECONDS
        )
      )
    );
    if (counters.some(count => typeof count !== "number" || count > CHALLENGE_ISSUE_RATE_LIMIT)) {
      throw new HttpException("Too many proof-of-work challenges", HttpStatus.TOO_MANY_REQUESTS);
    }

    const config = this.configService.config.security.proofOfWork;
    const issuedAt = Date.now();
    const challenge = {
      id: randomUUID(),
      randomData: randomBytes(64).toString("hex"),
      difficulty: EXPENSIVE_ACTIONS.has(action) ? config.expensiveActionDifficulty : config.difficulty,
      expiresAt: issuedAt + CHALLENGE_EXPIRATION_SECONDS * 1000
    };
    const record: ChallengeRecord = {
      action,
      ...binding,
      difficulty: challenge.difficulty,
      expiresAt: challenge.expiresAt,
      issuedAt,
      randomData: challenge.randomData
    };
    const stored = await this.redis.set(
      `${REDIS_KEY_CHALLENGE_PREFIX}${challenge.id}`,
      JSON.stringify(record),
      "EX",
      CHALLENGE_EXPIRATION_SECONDS,
      "NX"
    );
    if (stored !== "OK") throw new Error("Failed to store proof-of-work challenge");
    return challenge;
  }

  async verify(
    serializedResult: string | undefined,
    action: ProofOfWorkAction,
    binding: RequestBinding
  ): Promise<boolean> {
    if (!serializedResult) return false;

    let result: unknown;
    try {
      result = JSON.parse(serializedResult);
    } catch (error) {
      const exception = new BadRequestException("Proof-of-work result is not valid JSON");
      Object.defineProperty(exception, "cause", { value: error });
      throw exception;
    }
    if (!isProofOfWorkResult(result)) throw new BadRequestException("Proof-of-work result has an invalid shape");

    const serializedRecord = await this.takeRedisValue(`${REDIS_KEY_CHALLENGE_PREFIX}${result.id}`);
    if (!serializedRecord) return false;

    const record = JSON.parse(serializedRecord) as ChallengeRecord;
    if (
      record.action !== action ||
      record.remoteIp !== binding.remoteIp ||
      record.sessionId !== binding.sessionId ||
      record.userId !== binding.userId
    ) {
      return false;
    }

    // This preserves Anubis's fast challenge protocol while binding every proof
    // to one API action: https://github.com/TecharoHQ/anubis/blob/59bd4f6eea08919494ec567bccc7d1a8f51e8de4/lib/challenge/proofofwork/proofofwork.go#L36-L94
    const expectedResponse = createHash("sha256").update(record.randomData).update(String(result.nonce)).digest();
    const submittedResponse = Buffer.from(result.response, "hex");
    const valid =
      timingSafeEqual(expectedResponse, submittedResponse) && result.response.startsWith("0".repeat(record.difficulty));
    if (valid) {
      this.metricSolveTime
        .labels({ action: record.action, difficulty: String(record.difficulty) })
        .observe((Date.now() - record.issuedAt) / 1000);
    }
    return valid;
  }

  private async takeRedisValue(key: string): Promise<string | undefined> {
    const result = await this.redis.eval(TAKE_REDIS_VALUE_SCRIPT, 1, key);
    if (result === null) return undefined;
    if (typeof result !== "string") throw new Error("Redis returned an invalid one-time proof-of-work value");
    return result;
  }
}
