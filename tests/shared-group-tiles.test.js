// Verify the shared group-tiles resolver consumes the server-enriched
// fellow_avatar_* fields on member rows when the viewer doesn't own the
// fellow. Without this, web's group sidebar tiles fall back to blank
// single-letter bubbles for any fellow added by another user.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveGroupMemberTiles } = require("../src/shared/group-tiles");
const { avatarAssetForKey, avatarDefaultCropForSrc } = require("../src/shared/avatar-resolve");

test("group tile prefers the owned fellow's avatar over the member-row enrichment", () => {
  const members = [
    {
      member_kind: "fellow",
      member_ref: "kongling",
      // Server still echoes enrichment even when the viewer is the owner.
      fellow_avatar_image: "stale-server-copy.png",
      fellow_avatar_crop: { x: 99, y: 99 },
      fellow_color: "#000000"
    }
  ];
  const tiles = resolveGroupMemberTiles(members, {
    fellows: [{ id: "kongling", avatarImage: "fresh-local.png", avatarCrop: { x: 50, y: 50 }, color: "#5e5ce6" }]
  });
  assert.deepEqual(tiles, [{ image: "fresh-local.png", crop: { x: 50, y: 50 }, color: "#5e5ce6" }]);
});

test("group tile falls back to enriched member-row fields for cross-owner fellows", () => {
  // Viewer doesn't own this fellow — ctx.fellows is empty.
  const members = [
    {
      member_kind: "fellow",
      member_ref: "alice-fellow",
      fellow_avatar_image: "alice-friend-avatar.png",
      fellow_avatar_crop: { x: 30, y: 70, zoom: 1.2 },
      fellow_color: "#ff9f0a"
    }
  ];
  const tiles = resolveGroupMemberTiles(members, { fellows: [] });
  assert.deepEqual(tiles, [{
    image: "alice-friend-avatar.png",
    crop: { x: 30, y: 70, zoom: 1.2 },
    color: "#ff9f0a"
  }]);
});

test("group tile falls back to shared stable avatar when neither ctx.fellows nor member row carries an image", () => {
  const members = [{ member_kind: "fellow", member_ref: "unknown-fellow" }];
  const tiles = resolveGroupMemberTiles(members, { fellows: [] });
  const expectedImage = avatarAssetForKey("unknown-fellow");
  assert.equal(tiles[0].image, expectedImage);
  assert.deepEqual(tiles[0].crop, avatarDefaultCropForSrc(expectedImage));
  assert.equal(tiles[0].color, "#5e5ce6");
});

test("group tile blends owned color with enriched member-row image only when the owned fellow lacks an image", () => {
  // A fellow that exists in the local registry but with no avatarImage —
  // member-row enrichment should fill the image while owned color wins.
  const members = [
    {
      member_kind: "fellow",
      member_ref: "shy-fellow",
      fellow_avatar_image: "server-fallback.png",
      fellow_color: "#888888"
    }
  ];
  const tiles = resolveGroupMemberTiles(members, {
    fellows: [{ id: "shy-fellow", avatarImage: "", color: "#5e5ce6" }]
  });
  assert.equal(tiles[0].image, "server-fallback.png");
  assert.equal(tiles[0].color, "#5e5ce6");
});
