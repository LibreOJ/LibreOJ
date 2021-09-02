import getGitRepoInfo from "git-repo-info";

import applicationConfig from "./config.json";

export default {
  applicationConfig,
  buildInfo: {
    buildTime: new Date().toISOString(),
    buildCommit: getGitRepoInfo().sha
  }
};
