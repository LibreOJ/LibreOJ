import { IsIn } from "class-validator";

export default class CompileAndRunOptionsHaskell {
  @IsIn(["98", "2010", "GHC2021"])
  version: string;
}
