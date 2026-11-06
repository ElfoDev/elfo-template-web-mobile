import { resolveApiUrl } from "./api-url";

describe("resolveApiUrl", () => {
  it("prefers EXPO_PUBLIC_API_URL and strips trailing slashes", () => {
    expect(
      resolveApiUrl({
        envUrl: "https://api.example.com/",
        hostUri: "192.168.0.10:8081",
        platform: "ios",
      }),
    ).toBe("https://api.example.com");
  });

  it("uses the Metro host on native when no env URL is set", () => {
    expect(resolveApiUrl({ hostUri: "192.168.0.10:8081", platform: "android" })).toBe(
      "http://192.168.0.10:8787",
    );
  });

  it("falls back to the Android emulator host alias", () => {
    expect(resolveApiUrl({ hostUri: null, platform: "android" })).toBe("http://10.0.2.2:8787");
  });

  it("falls back to localhost on web and iOS", () => {
    expect(resolveApiUrl({ hostUri: "localhost:8081", platform: "web" })).toBe(
      "http://localhost:8787",
    );
    expect(resolveApiUrl({ platform: "ios" })).toBe("http://localhost:8787");
  });

  it("ignores a blank env URL", () => {
    expect(resolveApiUrl({ envUrl: "  ", platform: "web" })).toBe("http://localhost:8787");
  });
});
