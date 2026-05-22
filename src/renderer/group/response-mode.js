(function (global) {
  "use strict";

  const GROUP_RESPONSE_MODE = Object.freeze({
    Conductor: "conductor",
    MentionsOnly: "mentions-only",
  });

  function normalizeGroupResponseMode(value) {
    return value === GROUP_RESPONSE_MODE.MentionsOnly
      ? GROUP_RESPONSE_MODE.MentionsOnly
      : GROUP_RESPONSE_MODE.Conductor;
  }

  function groupResponseMode(group) {
    return normalizeGroupResponseMode(group?.decorations?.responseMode || group?.responseMode);
  }

  function groupResponseModePatch(group, value) {
    return {
      decorations: {
        ...(group?.decorations || {}),
        responseMode: normalizeGroupResponseMode(value),
      },
    };
  }

  function shouldAskConductor(group, mentions = []) {
    return groupResponseMode(group) === GROUP_RESPONSE_MODE.Conductor && (!mentions || mentions.length === 0);
  }

  const api = {
    GROUP_RESPONSE_MODE,
    normalizeGroupResponseMode,
    groupResponseMode,
    groupResponseModePatch,
    shouldAskConductor,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.aimashiGroupResponseMode = api;
})(typeof window !== "undefined" ? window : globalThis);
