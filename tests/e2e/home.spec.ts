import { expect, test } from "@playwright/test";

test("renders the command center in setup/demo mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Task Command Center" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Daily/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Capture/ })).toBeVisible();
  await expect(page.getByText("Send launch-risk checklist")).toBeVisible();
});

test("switches to board view on mobile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Board/ }).click();
  await expect(page.getByRole("heading", { name: "Delegated" })).toBeVisible();
});
