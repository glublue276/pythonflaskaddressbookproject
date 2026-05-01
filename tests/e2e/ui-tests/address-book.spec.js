const { test, expect } = require("@playwright/test");


function contactCard(page, fullName) {
  return page.locator(".contact-card").filter({
    has: page.getByRole("heading", { name: fullName }),
  });
}


test("loads the address book home page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Address Book" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contacts" })).toBeVisible();
  await expect(page.locator("#contacts")).toBeVisible();

  const hasContacts = await page.locator(".contact-card").count();
  if (hasContacts > 0) {
    await expect(page.locator(".contact-card").first()).toBeVisible();
  } else {
    await expect(page.getByText("No contacts found.")).toBeVisible();
  }
});


test("can surface contact changes in the UI and delete the record", async ({
  page,
  request,
}) => {
  const uniqueSuffix = Date.now().toString();
  const firstName = `Playwright${uniqueSuffix}`;
  const lastName = "Smoke";
  const fullName = `${firstName} ${lastName}`;
  const customFieldName = "source";
  const customFieldValue = "e2e";
  let createdContactId = null;

  try {
    const createResponse = await request.post("/api/contacts", {
      data: {
        first_name: firstName,
        last_name: lastName,
        address: "1 Playwright Way",
        phone_number: "555-0101",
        extra_fields: {
          [customFieldName]: customFieldValue,
        },
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const createdContact = await createResponse.json();
    createdContactId = createdContact.id;

    await page.goto("/");
    await page.locator('#search-form input[name="first_name"]').fill(firstName);
    await page.getByRole("button", { name: "Search" }).click();

    const createdCard = contactCard(page, fullName);
    await expect(createdCard).toBeVisible();
    await expect(createdCard.getByText(`${customFieldName}: ${customFieldValue}`)).toBeVisible();
    await expect(page.locator(".contact-card")).toHaveCount(1);

    const updateFieldResponse = await request.patch(
      `/api/contacts/${createdContactId}/fields`,
      {
        data: {
          field_name: "nickname",
          value: "PW",
        },
      },
    );
    expect(updateFieldResponse.ok()).toBeTruthy();

    await page.getByRole("button", { name: "Refresh" }).click();

    const updatedCard = contactCard(page, fullName);
    await expect(updatedCard.getByText("nickname: PW")).toBeVisible();

    await page.getByRole("button", { name: "Reset" }).click();
    await page.locator('#search-form input[name="keyword"]').fill("PW");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(updatedCard).toBeVisible();

    await updatedCard.locator(".delete-contact").click();
    await expect(updatedCard).not.toBeVisible();
    createdContactId = null;
  } finally {
    if (createdContactId) {
      await request.delete(`/api/contacts/${createdContactId}`);
    }
  }
});
