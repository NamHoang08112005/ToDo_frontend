import { catalog, recommendations } from "./catalog";

test("feedback promotes another item with the same topic and viewing suppresses repeats", () => {
  const order = (h: Parameters<typeof recommendations>[1]) =>
    recommendations(catalog, h).map((r) => r.media.id);
  const cold = order({});
  const warm = order({ coffee: { opened: true, liked: true, saved: true } });
  expect(cold[0]).toBe("tokyo");
  expect(warm[0]).toBe("sushi");
  expect(warm.indexOf("sushi")).toBeLessThan(cold.indexOf("sushi"));
  expect(
    recommendations(catalog, { coffee: { liked: true } })[0].reason,
  ).toContain("Ẩm thực");
});

test("negative feedback lowers the rank of related content", () => {
  const result = recommendations(catalog, { tokyo: { hidden: true } });
  const cold = recommendations(catalog, {});
  const score = (list: typeof cold) =>
    list.find((r) => r.media.id === "bay")!.score;
  expect(score(result)).toBeLessThan(score(cold));
});
