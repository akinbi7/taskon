import { describe, expect, it } from "vitest";
import { channelRefFromUrl } from "../../../supabase/functions/_shared/links";

describe("channelRefFromUrl", () => {
  it("accepts @names and public t.me links", () => {
    expect(channelRefFromUrl("@taskonnotes")).toBe("@taskonnotes");
    expect(channelRefFromUrl("https://t.me/taskonnotes")).toBe("@taskonnotes");
    expect(channelRefFromUrl("https://telegram.me/taskonnotes/123")).toBe("@taskonnotes");
    expect(channelRefFromUrl("https://t.me/taskonnotes?start=1")).toBe("@taskonnotes");
  });

  it("accepts numeric channel ids used by some private channels", () => {
    expect(channelRefFromUrl("-1001234567890")).toBe("-1001234567890");
  });

  it("rejects invite links, other hosts and junk", () => {
    expect(channelRefFromUrl("https://t.me/+abc123")).toBeNull();
    expect(channelRefFromUrl("https://t.me/joinchat/abc123")).toBeNull();
    expect(channelRefFromUrl("https://example.com/taskonnotes")).toBeNull();
    expect(channelRefFromUrl("not a link")).toBeNull();
  });
});
