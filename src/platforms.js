const platformMatchers = [
  {
    platform: "android",
    distribution: "apk",
    matches: (assetName) => /android\.apk$/i.test(assetName)
  },
  {
    platform: "windows",
    distribution: "exe",
    matches: (assetName) => /win64-installer\.exe$/i.test(assetName)
  },
  {
    platform: "macos",
    distribution: "dmg",
    matches: (assetName) => /macos\.dmg$/i.test(assetName)
  },
  {
    platform: "macos",
    distribution: "zip",
    matches: (assetName) => /macos\.zip$/i.test(assetName)
  },
  {
    platform: "linux",
    distribution: "appimage",
    matches: (assetName) => /\.appimage$/i.test(assetName)
  },
  {
    platform: "linux",
    distribution: "deb",
    matches: (assetName) => /\.deb$/i.test(assetName)
  },
  {
    platform: "linux",
    distribution: "rpm",
    matches: (assetName) => /\.rpm$/i.test(assetName)
  }
];

export function classifyAsset(assetName) {
  if (/\.asc$/i.test(assetName)) {
    return null;
  }

  for (const matcher of platformMatchers) {
    if (matcher.matches(assetName)) {
      return {
        platform: matcher.platform,
        distribution: matcher.distribution
      };
    }
  }

  return null;
}
