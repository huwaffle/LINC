import fs from "node:fs";
import { chromium } from "playwright-core";

/**
 * Browser checks for the current LINC UI.
 *
 * Helper student accounts come from tests/e2e-accounts.json and are created by
 * scripts/seed-e2e-users.ts. `npm run e2e` seeds them and the demo ads before
 * this file runs, so repeated runs against a dev server stay deterministic.
 * The USC administrator and the real-named students use the demo password.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const accounts = JSON.parse(fs.readFileSync(new URL("./e2e-accounts.json", import.meta.url), "utf8"));
const PASSWORD = "12345678";
const S = accounts.students;
const ACTIVITY = { email: "juan.cruz@dlsau.edu.ph", username: "juan", displayName: "Juan Cruz" };
const ADMIN = { username: "usc", email: "usc@dlsau.edu.ph", password: PASSWORD };

const stamp = Date.now();
const title = `E2E shuttle schedule update ${stamp}`;
const rejectTitle = `E2E missing facilities report ${stamp}`;
const anonTitle = `E2E anonymous concern ${stamp}`;
const anonRejectReason = `Anonymous test entry returned for revision ${stamp}.`;
const reportReason = `E2E report: misleading schedule details ${stamp}`;
const removeReason = `E2E removal: outdated information ${stamp}`;
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const rx = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

async function inlineImageLoaded(page) {
  const image = page.locator('img[src^="/api/files/"]').first();
  const appeared = await image
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return false;
  await image.scrollIntoViewIfNeeded().catch(() => {});
  return page
    .waitForFunction(
      () => {
        const node = document.querySelector('img[src^="/api/files/"]');
        return Boolean(node && node.complete && node.naturalWidth > 0);
      },
      null,
      { timeout: 10000 },
    )
    .then(() => true)
    .catch(() => false);
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const seen = (locator, timeout = 10000) =>
  locator
    .first()
    .waitFor({ timeout })
    .then(() => true)
    .catch(() => false);

async function login(page, identifier, password = PASSWORD) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email or student number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
  if (new URL(page.url()).pathname === "/login") {
    throw new Error(`Could not sign in as ${identifier}. Run \`npm run db:seed-e2e\` if the e2e accounts are missing.`);
  }
}

const loginAs = (page, account) => login(page, account.email);

async function signOut(page) {
  // The rail and the profile page can both render the button; either one works.
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await page.waitForLoadState("networkidle");
}

/** Clicks "Delete" in the in-app confirmation dialog and waits for the form post. */
async function confirmDelete(page) {
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click(),
  ]);
}

/** Finds a post in the admin queue, follows its Review link, and returns its id. */
async function openAdminReview(page, postTitle) {
  await page.goto(`${BASE}/admin/posts?q=${encodeURIComponent(postTitle)}`);
  const byRow = page
    .getByRole("row", { name: rx(postTitle) })
    .getByRole("link", { name: "Review" });
  const link =
    (await byRow.count()) > 0
      ? byRow.first()
      : page
          .locator("div")
          .filter({ hasText: rx(postTitle) })
          .filter({ has: page.getByRole("link", { name: "Review" }) })
          .last()
          .getByRole("link", { name: "Review" });
  await seen(link);
  const href = await link.getAttribute("href");
  await link.click();
  await page.waitForLoadState("networkidle");

  const idFrom = (url) => {
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last && last !== "posts" ? last : "";
  };
  const current = new URL(page.url());
  const target = new URL(href ?? page.url(), BASE);
  return (
    current.searchParams.get("review") ??
    target.searchParams.get("review") ??
    current.searchParams.get("id") ??
    target.searchParams.get("id") ??
    idFrom(current) ??
    idFrom(target) ??
    ""
  );
}

const browser = await chromium.launch({ channel: "msedge", headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Home opens on the reels feed
  await page.goto(BASE);
  check("home opens the reels feed by default", await seen(page.locator("[data-reel]")));
  const reels = await page.evaluate(() => {
    const slides = [...document.querySelectorAll("[data-reel]")];
    const scroller = slides[0]?.parentElement;
    return {
      count: slides.length,
      oneScreenEach: Boolean(scroller && slides.every((slide) => slide.clientHeight === scroller.clientHeight)),
      noInnerScroll: slides.every((slide) => {
        // Sponsored slides are <aside>s; posts are <article>s. Neither may scroll.
        const panel = slide.querySelector("article, aside");
        return Boolean(panel && panel.scrollHeight <= panel.clientHeight + 1);
      }),
    };
  });
  check("reels show one post per screen", reels.count > 1 && reels.oneScreenEach, `${reels.count} posts`);
  check("a reel post never scrolls inside itself", reels.noInnerScroll);

  const scrollTop = () => page.evaluate(() => document.querySelector("[data-reel]").parentElement.scrollTop);
  const screenHeight = () => page.evaluate(() => document.querySelector("[data-reel]").parentElement.clientHeight);
  await page.waitForLoadState("networkidle");
  let movedDown = false;
  for (let attempt = 0; attempt < 3 && !movedDown; attempt += 1) {
    await page.keyboard.press("ArrowDown");
    movedDown = await page
      .waitForFunction(
        () => {
          const s = document.querySelector("[data-reel]").parentElement;
          return s.scrollTop >= s.clientHeight - 2;
        },
        null,
        { timeout: 3000 },
      )
      .then(() => true)
      .catch(() => false);
  }
  check("arrow down moves to the next reel", movedDown, `${await scrollTop()}px of ${await screenHeight()}px`);
  await page.keyboard.press("ArrowUp");
  const movedUp = await page
    .waitForFunction(() => document.querySelector("[data-reel]").parentElement.scrollTop <= 2, null, {
      timeout: 5000,
    })
    .then(() => true)
    .catch(() => false);
  check("arrow up goes back to the previous reel", movedUp);

  const autoSwitch = page.getByRole("switch", { name: /Auto-scroll/ });
  check(
    "auto-scroll is off by default with no progress bar",
    (await autoSwitch.getAttribute("aria-checked")) === "false" &&
      (await page.getByRole("progressbar").count()) === 0,
  );
  await autoSwitch.click();
  check(
    "turning auto-scroll on shows the progress bar",
    (await autoSwitch.getAttribute("aria-checked")) === "true" && (await seen(page.getByRole("progressbar"), 5000)),
  );
  await autoSwitch.click();
  check(
    "turning auto-scroll off removes the progress bar",
    (await autoSwitch.getAttribute("aria-checked")) === "false" && (await page.getByRole("progressbar").count()) === 0,
  );

  await page.keyboard.press("ArrowDown");
  await page
    .locator('[data-page-header]')
    .getByRole("link", { name: "Concerns", exact: true })
    .click();
  await page.waitForURL(/category=concerns/);
  await page.waitForLoadState("networkidle");
  const concerns = await page.evaluate(() => {
    const slides = [...document.querySelectorAll("[data-reel]")];
    return {
      top: slides[0]?.parentElement.scrollTop ?? -1,
      // Sponsored slides run in every category; only post slides carry the label.
      allConcerns:
        slides.length > 0 && slides.every((s) => !s.querySelector("article") || s.textContent.includes("Concerns")),
    };
  });
  check(
    "picking a category in reels starts at that category's first post",
    concerns.top === 0 && concerns.allConcerns,
  );

  await page.locator("[data-page-header]").getByRole("link", { name: /^list$/i }).click();
  await page.waitForURL(/view=list/);
  check("the List switch opens the classic feed", await seen(page.locator("article")));

  // 1b. Public list feed
  await page.goto(`${BASE}/?view=list`);
  const feedBody = await page.textContent("body");
  check(
    "public list feed renders",
    feedBody.includes("For you") && feedBody.includes("Sign in to share a post"),
  );
  check("feed shows seeded posts", feedBody.includes("Updated shuttle schedule for the Malabon campus"));

  await page.goto(`${BASE}/c/announcements`);
  check("public feed shows a seeded picture inline", await inlineImageLoaded(page));

  // Header and column sizing must not jump between Home and Search.
  const measure = () =>
    page.evaluate(() => {
      const main = document.querySelector("main");
      const header = document.querySelector("[data-page-header]");
      const titleRow = header?.firstElementChild;
      return {
        width: Math.round(main?.getBoundingClientRect().width ?? 0),
        header: Math.round(header?.getBoundingClientRect().height ?? 0),
        titleRow: Math.round(titleRow?.getBoundingClientRect().height ?? 0),
      };
    });
  await page.goto(`${BASE}/?view=list`);
  await page.waitForLoadState("networkidle");
  const homeMetrics = await measure();
  await page.goto(`${BASE}/search?q=library`);
  await page.waitForLoadState("networkidle");
  const searchMetrics = await measure();
  check(
    "feed column width matches between Home and Search",
    homeMetrics.width > 0 && homeMetrics.width === searchMetrics.width,
    `${homeMetrics.width}px vs ${searchMetrics.width}px`,
  );
  check(
    "page header is found on both pages",
    homeMetrics.header > 0 && searchMetrics.header > 0,
    `${homeMetrics.header}px and ${searchMetrics.header}px`,
  );
  check(
    "header height matches between Home and Search",
    homeMetrics.header === searchMetrics.header && homeMetrics.titleRow === searchMetrics.titleRow,
    `${homeMetrics.header}px vs ${searchMetrics.header}px (title row ${homeMetrics.titleRow}px vs ${searchMetrics.titleRow}px)`,
  );

  // Search typeahead fills the box with a matching post title.
  await page.goto(`${BASE}/search`);
  await page.getByLabel("Keywords").fill("shuttle");
  const suggestion = page.getByRole("listbox").getByRole("option").first();
  const suggested = await seen(suggestion, 8000);
  check("search box shows matching suggestions", suggested);
  if (suggested) {
    await suggestion.click();
    await page.waitForLoadState("networkidle");
    check(
      "picking a suggestion fills the search box",
      /shuttle/i.test(await page.getByLabel("Keywords").inputValue()),
    );
  } else {
    check("picking a suggestion fills the search box", false);
  }

  // Navigation rail on the far left, the feed centered, supporting panels on the right.
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const railLayout = await page.evaluate(() => {
    const container = document.querySelector("[data-linc-shell]");
    const main = document.querySelector("main");
    const nav = container?.querySelector(":scope > nav");
    const aside = container?.querySelector("aside.no-scrollbar");
    const pinnedAd = container?.querySelector('aside[aria-label="Advertisements"]');
    if (!main || !nav || !aside) return null;
    const mainBox = main.getBoundingClientRect();
    const navBox = nav.getBoundingClientRect();
    const asideBox = aside.getBoundingClientRect();
    const adBox = pinnedAd?.getBoundingClientRect();
    return {
      navOnLeft: navBox.right <= mainBox.left + 1,
      navAtLeftEdge: navBox.left <= 1,
      asideOnRight: asideBox.left >= mainBox.right - 1,
      asideScrollbarHidden: aside.classList.contains("no-scrollbar"),
      feedOffset: Math.round((mainBox.left + mainBox.right) / 2 - (container.getBoundingClientRect().left + container.getBoundingClientRect().right) / 2),
      adAbovePanels: Boolean(adBox && adBox.bottom <= asideBox.top + 1),
    };
  });
  check("navigation column sits to the left of the feed", Boolean(railLayout?.navOnLeft));
  check("navigation column sits at the far-left edge", Boolean(railLayout?.navAtLeftEdge));
  check(
    "the feed is centered in the window",
    Math.abs(railLayout?.feedOffset ?? 99) <= 2,
    `${railLayout?.feedOffset}px off center`,
  );
  check("supporting panels sit to the right of the feed", Boolean(railLayout?.asideOnRight));
  check("supporting panel scrollbar is hidden", Boolean(railLayout?.asideScrollbarHidden));
  check("the sponsored card stays pinned above the scrolling panels", Boolean(railLayout?.adAbovePanels));

  const footerBody = await page.textContent("body");
  check(
    "about card shows the footer links",
    footerBody.includes("© 2026") &&
      footerBody.includes("LINC Terms") &&
      footerBody.includes("Privacy Policy") &&
      footerBody.includes("Cookies Policy") &&
      footerBody.includes("Cookie Settings") &&
      footerBody.includes("Report a problem"),
  );

  check("support panel shows trending posts", footerBody.includes("Trending this week"));

  const privacyLink = page.getByRole("link", { name: "Privacy Policy" }).first();
  check(
    "footer links open the local about page",
    (await privacyLink.getAttribute("href")) === "/about#privacy",
  );
  await privacyLink.click();
  await page.waitForURL(/\/about(#privacy)?$/);
  check(
    "footer links open the local about page",
    (await page.textContent("body")).includes("Privacy Policy"),
  );

  // 1a. Dark mode applies immediately and survives a reload
  await page.getByRole("button", { name: "Switch to dark mode" }).first().click();
  check(
    "dark mode toggle applies the theme",
    await page.evaluate(() => document.documentElement.classList.contains("dark")),
  );
  check(
    "dark mode repaints the page background",
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor !== "rgb(250, 250, 250)"),
  );
  await page.reload();
  await page.waitForLoadState("networkidle");
  check(
    "dark mode preference persists after reload",
    await page.evaluate(() => document.documentElement.classList.contains("dark")),
  );
  await page.getByRole("button", { name: "Switch to light mode" }).first().click();
  check(
    "theme can switch back to light",
    !(await page.evaluate(() => document.documentElement.classList.contains("dark"))),
  );

  // 2. Student login
  await loginAs(page, S.main);
  const signedIn = await page.getByRole("button", { name: "Sign out" }).first().isVisible();
  check("student session shows My activity", signedIn);

  // 2a. Every account can change its nickname and profile picture
  const nickname = `Demo Lasallian ${stamp}`;
  await page.goto(`${BASE}/settings`);
  await page.getByLabel("Nickname").fill(nickname);
  await page.setInputFiles("#avatar", {
    name: "avatar.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForLoadState("networkidle");
  const settingsBody = await page.textContent("body");
  check("account settings save a nickname", settingsBody.includes(nickname));
  check("username stays fixed in settings", settingsBody.includes(`@${S.main.username}`));
  const avatarLoaded = await page
    .waitForFunction(
      () => {
        const node = document.querySelector('img[src^="/api/avatars/"]');
        return Boolean(node && node.complete && node.naturalWidth > 0);
      },
      null,
      { timeout: 10000 },
    )
    .then(() => true)
    .catch(() => false);
  check("account settings save a profile picture", avatarLoaded);

  await signOut(page);
  await loginAs(page, S.main);
  check("nickname survives signing out and back in", (await page.textContent("body")).includes(nickname));

  // 2b. Likes, reposts, saved posts, and account profiles
  await page.goto(`${BASE}/?view=list`);
  const firstArticle = page.locator("article").first();
  const firstTitle = (await firstArticle.locator("h2").first().textContent())?.trim() ?? "";
  const authorHref = await firstArticle
    .getByRole("link", { name: /^View .+ profile$/ })
    .first()
    .getAttribute("href");
  check("post author links to a profile", Boolean(authorHref?.startsWith("/u/")), authorHref ?? "");

  // The suite can be rerun against the same database, so reset a reaction
  // that a previous run may have left toggled before testing the toggle again.
  if ((await firstArticle.getByRole("button", { name: "Unlike post" }).count()) > 0) {
    await firstArticle.getByRole("button", { name: "Unlike post" }).click();
    await page.reload();
    await page.waitForLoadState("networkidle");
  }
  await firstArticle.getByRole("button", { name: "Like post" }).click();
  await firstArticle.getByRole("button", { name: "Unlike post" }).waitFor();
  check("student can like a post", true);

  const repostArticle = page.locator("article").first();
  if ((await repostArticle.getByRole("button", { name: "Undo repost" }).count()) > 0) {
    await repostArticle.getByRole("button", { name: "Undo repost" }).click();
    await page.reload();
    await page.waitForLoadState("networkidle");
  }
  await repostArticle.getByRole("button", { name: "Repost post" }).click();
  await repostArticle.getByRole("button", { name: "Undo repost" }).waitFor();
  check("student can repost a post", true);

  await page.goto(`${BASE}/activity`);
  await page.waitForLoadState("networkidle");
  const outgoingBody = await page.textContent("body");
  check(
    "activity lists what the student did",
    outgoingBody.includes("You liked") && outgoingBody.includes("You reposted"),
  );
  await page.goto(`${BASE}/?view=list`);

  await page.locator("article").first().locator('summary[aria-label="More options"]').click();
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.locator("article").first().getByRole("button", { name: "Save post" }).click(),
  ]);
  check("secondary actions live behind the More menu", true);
  check(
    "saving a post adds a count badge to Saved",
    await seen(page.getByRole("link", { name: "Saved, 1 saved" }), 10000),
  );

  await page.goto(`${BASE}/saved`);
  check("saved page lists the bookmarked post", (await page.textContent("body")).includes(firstTitle));

  await page.locator("article").first().locator('summary[aria-label="More options"]').click();
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByRole("button", { name: "Remove from saved" }).first().click(),
  ]);
  await page.getByText("No saved posts").waitFor();
  check("saved post can be removed", true);
  check(
    "removing the last saved post clears the Saved badge",
    (await page.getByRole("link", { name: /^Saved, \d+ saved$/ }).count()) === 0,
  );

  await page.goto(`${BASE}/u/${ACTIVITY.username}`);
  const profileBody = await page.textContent("body");
  check(
    "account profile renders the account and its posts",
    profileBody.includes(ACTIVITY.displayName) && profileBody.includes("Posts"),
  );

  await page.goto(`${BASE}/u/${ACTIVITY.username}?tab=reposts`);
  check(
    "account profile lists reposts",
    (await page.textContent("body")).includes("Reposts") &&
      (await page.locator("article").count()) > 0,
  );

  // Seeded anonymous posts are detached from every account.
  await page.goto(`${BASE}/search?q=${encodeURIComponent("scholarship status")}`);
  const anonymousPost = page.locator("article", { hasText: "Where can I ask about my scholarship status?" }).first();
  await anonymousPost.waitFor({ timeout: 10000 }).catch(() => {});
  check(
    "seeded anonymous entry is not attributed to a profile",
    (await anonymousPost.count()) === 1 &&
      ((await anonymousPost.textContent()) ?? "").includes("Anonymous Lasallian") &&
      (await anonymousPost.locator('a[href^="/u/"]').count()) === 0,
  );

  // 2c. Event detail, month calendar, and .ics download
  await page.goto(`${BASE}/events`);
  await page.getByRole("link", { name: "Calendar" }).click();
  await page.waitForLoadState("networkidle");
  const calendarBody = await page.textContent("body");
  check(
    "events can be viewed as a month calendar",
    calendarBody.includes("Mon") &&
      calendarBody.includes("Previous") &&
      calendarBody.includes("Next"),
  );

  await page.getByRole("link", { name: "List" }).click();
  await page.waitForLoadState("networkidle");
  const eventHref = await page.locator('a[href^="/events/"]').first().getAttribute("href");
  check("event list links to an event detail page", Boolean(eventHref), eventHref ?? "");

  await page.goto(`${BASE}${eventHref}`);
  await page.getByText("Who is going").waitFor();
  const eventBody = await page.textContent("body");
  check(
    "event detail offers an I am going reaction and attendee list",
    eventBody.includes("Add to calendar") &&
      eventBody.includes("Who is going") &&
      /I am going|Going/.test(eventBody),
  );

  const eventId = (eventHref ?? "").split("/").pop();
  const icsResponse = await page.request.get(`${BASE}/api/events/${eventId}/ics`);
  const icsBody = await icsResponse.text();
  check(
    "event can be downloaded as a calendar file",
    Boolean(icsResponse.headers()["content-type"]?.includes("text/calendar")) &&
      icsBody.includes("BEGIN:VCALENDAR") &&
      icsBody.includes("END:VEVENT"),
  );

  // 3. Student submits an entry
  await page.goto(`${BASE}/submit`);
  const attachmentAccept = await page.getByLabel(/Attachment/).getAttribute("accept");
  check(
    "submit form accepts photos and videos",
    Boolean(attachmentAccept?.includes("image/png") && attachmentAccept?.includes("video/mp4")),
  );

  // Short titles and bodies are allowed; no minimum length is imposed.
  const shortTitle = `Q${stamp.toString().slice(-6)}`;
  const shortBody = `B${stamp.toString().slice(-6)}`;
  await page.getByLabel("Title").fill(shortTitle);
  await page.getByLabel("Category").selectOption({ value: "cat-concerns" });
  await page.getByLabel("Details").fill(shortBody);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.waitForURL((url) => url.pathname === "/me");
  await page.getByText(shortTitle).first().waitFor({ timeout: 10000 });
  const shortBodyText = await page.textContent("body");
  check(
    "short post title and details are accepted",
    shortBodyText.includes(shortTitle) && shortBodyText.includes(shortBody),
  );

  await page.goto(`${BASE}/submit`);
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Category").selectOption({ value: "cat-concerns" });
  await page
    .getByLabel("Details")
    .fill(
      "The shuttle schedule posted at the gate does not match the published timetable. The last trip leaves thirty minutes earlier than announced, which affects students with evening classes.",
    );
  await page.setInputFiles("#attachment", {
    name: "shuttle-photo.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.waitForURL((url) => url.pathname === "/me");
  await page.getByText(title).first().waitFor({ timeout: 10000 });
  const meBody = await page.textContent("body");
  check("submission lands in student activity", meBody.includes(title));
  check("submission is pending", meBody.includes("Pending") || meBody.includes("pending"));

  // 3a. Drafts, editing, submission, and deletion
  const draftTitle = `E2E private draft ${stamp}`;
  const draftTitleEdited = `${draftTitle} edited`;
  await page.goto(`${BASE}/submit`);
  await page.getByLabel("Title").fill(draftTitle);
  await page.getByLabel("Category").selectOption({ value: "cat-general" });
  await page.getByLabel("Details").fill("Private draft body for the lifecycle check.");
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByRole("button", { name: "Save draft" }).click(),
  ]);
  await page.waitForURL(/tab=drafts/);
  await page.getByText(/Draft saved/).first().waitFor({ timeout: 10000 });
  await page.waitForLoadState("networkidle");
  check(
    "student can save a private draft",
    page.url().includes("tab=drafts") && (await page.textContent("body")).includes(draftTitle),
  );

  await page
    .locator("article", { hasText: draftTitle })
    .first()
    .locator('summary[aria-label="More options"]')
    .click();
  await page.getByRole("link", { name: "Edit post" }).first().click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title").fill(draftTitleEdited);
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByRole("button", { name: "Save changes" }).click(),
  ]);
  await page.waitForURL(/tab=drafts/);
  await page.getByText("Draft updated.").first().waitFor({ timeout: 10000 });
  await page.waitForLoadState("networkidle");
  check(
    "draft edits save without a review round",
    (await page.textContent("body")).includes(draftTitleEdited),
  );

  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByRole("button", { name: "Submit for review" }).first().click(),
  ]);
  await page.waitForURL((url) => url.pathname === "/me");
  await page.getByText(/Draft submitted/).first().waitFor({ timeout: 10000 });
  await page.waitForLoadState("networkidle");
  check(
    "draft can be submitted into the review queue",
    new URL(page.url()).pathname === "/me" &&
      (await page.textContent("body")).includes(draftTitleEdited),
  );

  const shortArticle = page.locator("article", { hasText: shortTitle }).first();
  await shortArticle.locator('summary[aria-label="More options"]').click();
  await shortArticle.getByRole("button", { name: "Delete post" }).click();
  check(
    "deleting a post asks for confirmation first",
    await seen(page.getByRole("alertdialog").getByText("Delete this post and its comments?"), 5000),
  );
  await confirmDelete(page);
  await page.waitForURL(/notice=Post%20deleted/);
  await page.getByText("Post deleted.").first().waitFor({ timeout: 10000 });
  await page.waitForLoadState("networkidle");
  check(
    "student can delete their own post",
    (await page.locator("article", { hasText: shortTitle }).count()) === 0,
  );

  // 4. Pending entry is not on the public feed
  await page.goto(`${BASE}/?view=list`);
  const feedBefore = await page.textContent("body");
  check("pending entry hidden from public feed", !feedBefore.includes(title));

  // 5. The administrator sees it in the moderation queue and publishes
  await signOut(page);
  await login(page, ADMIN.username, ADMIN.password);
  await page.goto(`${BASE}/admin/posts`);
  const queueText = await page.textContent("body");
  check("moderation queue shows pending entry", queueText.includes(title));
  check(
    "moderation stays inside the admin console",
    queueText.includes("System console") &&
      (await page.getByRole("link", { name: /^Moderation/ }).count()) > 0,
  );

  const deskLayout = await page.evaluate(() => {
    const nav = document.querySelector("[data-linc-shell] > nav");
    const main = document.querySelector("main");
    if (!nav || !main) return null;
    const navBox = nav.getBoundingClientRect();
    const mainBox = main.getBoundingClientRect();
    return {
      navAtLeftEdge: navBox.left <= 1,
      offset: Math.round((mainBox.left + mainBox.right) / 2 - document.querySelector("[data-linc-shell]").getBoundingClientRect().width / 2),
      noAside: document.querySelector("aside.no-scrollbar") === null,
    };
  });
  check(
    "console keeps the rail at the edge and the feed centered",
    Boolean(deskLayout?.navAtLeftEdge) && Boolean(deskLayout?.noAside) && Math.abs(deskLayout?.offset ?? 99) <= 2,
    `${deskLayout?.offset}px off center`,
  );

  const reviewEntryId = await openAdminReview(page, title);
  check("moderation review shows the picture inline", await inlineImageLoaded(page));
  await page.getByRole("button", { name: "Publish entry" }).click();
  await page.waitForLoadState("networkidle");
  check("publish action confirms", await seen(page.getByText("Entry published."), 20000));

  // 6. Published entry appears publicly and in search
  await page.goto(`${BASE}/c/concerns/${reviewEntryId}`);
  check("published entry shows the picture inline", await inlineImageLoaded(page));

  await page
    .getByRole("button", { name: /Open shuttle-photo\.png full screen/ })
    .first()
    .click();
  const viewer = page.getByRole("dialog");
  check("post picture opens in a full-screen viewer", await seen(viewer));
  await viewer.getByRole("button", { name: "Zoom in" }).click();
  check("picture can be zoomed in", ((await viewer.textContent()) ?? "").includes("150%"));
  await viewer.getByRole("button", { name: "Zoom out" }).click();
  check("picture can be zoomed out", ((await viewer.textContent()) ?? "").includes("100%"));
  await viewer.getByRole("button", { name: "Close viewer" }).click();
  check("picture viewer closes", !(await viewer.isVisible()));

  // Seeded video posts use the same full-screen surface.
  await page.goto(`${BASE}/c/general`);
  await page.getByRole("link", { name: /Campus security advisory for evening classes/ }).first().click();
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", { name: /Open campus-walkthrough\.webm full screen/ })
    .first()
    .click();
  const videoViewer = page.getByRole("dialog");
  const videoOpened = await seen(videoViewer);
  check(
    "post video opens full screen with a player",
    videoOpened && (await videoViewer.locator("video").isVisible()),
  );
  await videoViewer.getByRole("button", { name: "Close viewer" }).click();
  check("video viewer closes", !(await videoViewer.isVisible()));

  await signOut(page);
  await page.goto(`${BASE}/?view=list`);
  check("published entry appears in feed", (await page.textContent("body")).includes(title));
  await page.goto(`${BASE}/search?q=shuttle`);
  check("full-text search finds entry", (await page.textContent("body")).includes(title));

  const uniqueQuery = encodeURIComponent(title);
  const resultTitles = async () => (await page.locator("article h2").allTextContents()).map((text) => text.trim());
  await page.goto(`${BASE}/search?q=${uniqueQuery}&sort=newest`);
  check("search filters keep the matching post", (await resultTitles()).includes(title));
  await page.goto(`${BASE}/search?q=${uniqueQuery}&from=2099-01-01`);
  check(
    "search date filter excludes older posts",
    (await page.textContent("body")).includes("No matching posts"),
  );

  // 6a. Comment replies and comment likes
  await loginAs(page, S.main);
  await page.goto(`${BASE}/c/concerns/${reviewEntryId}`);
  const commentText = `E2E comment ${stamp}`;
  await page.getByPlaceholder("Add a helpful reply…").fill(commentText);
  await page.getByRole("button", { name: "Post comment" }).click();
  await page.getByText("Comment posted.").first().waitFor({ timeout: 10000 });
  check("student can post a comment", (await page.textContent("body")).includes(commentText));

  const postedComment = page.locator("article", { hasText: commentText }).first();
  await postedComment.getByRole("button", { name: "Like comment" }).click();
  await page.getByText("Comment liked.").first().waitFor({ timeout: 10000 });
  const likedComment = page.locator("article", { hasText: commentText }).first();
  check(
    "student can like a comment",
    (await likedComment.getByRole("button", { name: "Unlike comment" }).count()) > 0,
  );

  const replyText = `E2E reply ${stamp}`;
  await likedComment.getByText("Reply", { exact: true }).click();
  await likedComment.getByPlaceholder(/Reply to/).fill(replyText);
  await likedComment.getByRole("button", { name: "Post reply" }).click();
  await page.getByText("Reply posted.").first().waitFor({ timeout: 10000 });
  check("student can reply to a comment", (await page.textContent("body")).includes(replyText));

  await page.reload();
  await page.waitForLoadState("networkidle");
  const persistedComment = page.locator("article", { hasText: commentText }).first();
  check(
    "comment like and reply persist after reload",
    (await page.textContent("body")).includes(replyText) &&
      (await persistedComment.getByRole("button", { name: "Unlike comment" }).count()) > 0,
  );

  const parentComment = page.locator("article", { hasText: commentText }).first();
  await parentComment.getByRole("button", { name: "Delete" }).first().click();
  await confirmDelete(page);
  await page.waitForURL(/notice=Comment%20deleted/);
  await page.getByText("Comment deleted.").first().waitFor({ timeout: 10000 });
  await parentComment.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
  check(
    "student can delete their own comment",
    (await page.locator("article", { hasText: commentText }).count()) === 0,
  );
  check(
    "deleting a comment keeps its replies",
    (await page.locator("article", { hasText: replyText }).count()) > 0,
  );
  await signOut(page);

  // 6b. Reporting needs a reason, and the administrator sees it
  await loginAs(page, S.reporter);
  await page.goto(`${BASE}/c/concerns/${reviewEntryId}`);
  await page.getByRole("button", { name: "Report this post" }).click();
  const reportDialog = page.getByRole("dialog");
  check("report opens a popup", await seen(reportDialog, 5000));
  const sendReport = reportDialog.getByRole("button", { name: "Send report" });
  check("report cannot be sent without a reason", await sendReport.isDisabled());
  await reportDialog.getByLabel("Reason for reporting").fill(reportReason);
  await sendReport.click();
  check(
    "report confirms inside the popup",
    await seen(reportDialog.getByText("Post reported")) &&
      (await reportDialog.textContent())?.includes("returned to the moderation queue"),
  );
  await reportDialog.getByRole("button", { name: "Done" }).click();
  await page.waitForLoadState("networkidle");
  await signOut(page);

  await login(page, ADMIN.username, ADMIN.password);
  await page.goto(`${BASE}/admin/outbox`);
  const outboxText = await page.textContent("body");
  check(
    "outbox names the reported post and the reason",
    outboxText.includes("Post reported:") && outboxText.includes(reportReason),
  );
  await openAdminReview(page, title);
  const reviewText = await page.textContent("body");
  check(
    "review page lists who reported the post and why",
    reviewText.includes("Reported by users") &&
      reviewText.includes(reportReason) &&
      reviewText.includes(S.reporter.displayName),
  );
  check(
    "a reported post can only be published or rejected, not removed",
    (await page.getByRole("button", { name: "Remove with reason" }).count()) === 0 &&
      (await page.getByRole("button", { name: "Reject with reason" }).count()) === 1,
  );

  // The administrator keeps the post, then edits it.
  await page.getByRole("button", { name: "Publish entry" }).click();
  await page.waitForLoadState("networkidle");
  await page.goto(`${BASE}/c/concerns/${reviewEntryId}/edit`);
  check(
    "administrator can open the edit page for any post",
    (await page.textContent("body")).includes("editing this post as an administrator"),
  );

  // 6c. A published post cannot be rejected; it is removed with a reason
  await openAdminReview(page, title);
  check(
    "a published post offers Remove with reason instead of Reject",
    (await page.getByRole("button", { name: "Remove with reason" }).count()) === 1 &&
      (await page.getByRole("button", { name: "Reject with reason" }).count()) === 0,
  );
  await page.getByRole("button", { name: "Remove with reason" }).click();
  check(
    "removing a post requires a reason",
    (await page.getByPlaceholder("Reason shown to the author").evaluate((el) => el.validity.valueMissing)) === true,
  );
  await page.getByPlaceholder("Reason shown to the author").fill(removeReason);
  await page.getByRole("button", { name: "Remove with reason" }).click();
  await page.waitForLoadState("networkidle");
  check("removing a post confirms", await seen(page.getByText("Post removed."), 20000));
  await signOut(page);

  await loginAs(page, S.main);
  await page.goto(`${BASE}/c/concerns/${reviewEntryId}`);
  const removedText = await page.textContent("body");
  check(
    "the author sees why the post will be deleted",
    removedText.includes("This post will be deleted due to:") && removedText.includes(removeReason),
  );
  await page.goto(`${BASE}/activity`);
  const removedActivity = await page.textContent("body");
  check(
    "the author is notified that the post was removed",
    removedActivity.includes("Your post was removed") && removedActivity.includes(removeReason),
  );
  await signOut(page);

  // 7. Rejection with reason reaches the student
  await loginAs(page, S.reject);
  await page.goto(`${BASE}/submit`);
  await page.getByLabel("Title").fill(rejectTitle);
  await page.getByLabel("Category").selectOption({ value: "cat-lost-found" });
  await page
    .getByLabel("Details")
    .fill(
      "The water dispenser on the third floor has been out of order since Monday and students in the evening shift have no access to drinking water.",
    );
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.waitForLoadState("networkidle");
  await signOut(page);

  await login(page, ADMIN.username, ADMIN.password);
  await openAdminReview(page, rejectTitle);
  await page.getByPlaceholder("Reason shown to the author").fill("Duplicate of an entry already answered.");
  await page.getByRole("button", { name: "Reject with reason" }).click();
  await page.waitForLoadState("networkidle");
  check("reject action confirms", await seen(page.getByText("Entry rejected."), 20000));

  await signOut(page);
  await loginAs(page, S.reject);
  await page.goto(`${BASE}/me`);
  const rejectedBody = await page.textContent("body");
  check("student sees rejection reason", rejectedBody.includes("Duplicate of an entry already answered."));

  const unreadBadge = page.getByRole("link", { name: /Activity, \d+ unread/ }).first();
  check("shell shows an unread activity badge", await unreadBadge.isVisible());

  const unreadResponse = await page.request.get(`${BASE}/api/activity/unread`);
  const unreadData = await unreadResponse.json().catch(() => ({}));
  check(
    "unread activity API reports the badge count",
    unreadResponse.ok() && Number(unreadData.unread) > 0,
    String(unreadData.unread ?? ""),
  );

  await page.goto(`${BASE}/activity`);
  const notificationBody = await page.textContent("body");
  check(
    "activity feed shows the rejection notification",
    notificationBody.includes("Your entry was rejected") &&
      notificationBody.includes("Duplicate of an entry already answered."),
  );
  await page.getByRole("button", { name: "Mark all read" }).click();
  await page.waitForLoadState("networkidle");
  check(
    "student can mark notifications read",
    (await page.textContent("body")).includes("All notifications marked as read."),
  );

  // 8. Anonymous submission is not linked back to the student
  await signOut(page);
  await loginAs(page, S.anon);
  await page.goto(`${BASE}/submit`);
  await page.getByLabel("Title").fill(anonTitle);
  await page.getByLabel("Category").selectOption({ value: "cat-general" });
  await page
    .getByLabel("Details")
    .fill(
      "This is an anonymous concern about the lighting along the north walkway. Several students have reported that the area is very dark after evening classes end.",
    );
  await page.getByLabel(/Submit anonymously/).check();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.waitForLoadState("networkidle");
  const receiptBody = await page.textContent("body");
  const receiptMatch = receiptBody.match(/[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/);
  check(
    "anonymous submission shows a receipt code",
    Boolean(receiptMatch) && receiptBody.includes("Receipt code"),
    receiptMatch?.[0] ?? "",
  );
  check(
    "receipt explains it is not linked to the account",
    receiptBody.includes("not linked to your account"),
  );

  await Promise.all([
    page.waitForURL(/\/track/),
    page.getByRole("button", { name: "I saved the code" }).click(),
  ]);
  check(
    "receipt opens tracking with a pending status",
    await seen(page.getByText("Waiting for admin review")),
  );

  await page.goto(`${BASE}/me`);
  check("anonymous entry excluded from activity", !(await page.textContent("body")).includes(anonTitle));

  await page.goto(`${BASE}/u/${S.anon.username}`);
  check(
    "anonymous entry excluded from the author profile",
    !(await page.textContent("body")).includes(anonTitle),
  );

  await signOut(page);
  await login(page, ADMIN.username, ADMIN.password);
  await page.goto(`${BASE}/admin/posts`);
  const queueBody = await page.textContent("body");
  check("anonymous entry reaches the moderation queue", queueBody.includes(anonTitle));
  check("anonymous author is masked", queueBody.includes("Anonymous Lasallian"));

  await openAdminReview(page, anonTitle);
  await page.getByPlaceholder("Reason shown to the author").fill(anonRejectReason);
  await page.getByRole("button", { name: "Reject with reason" }).click();
  await page.waitForLoadState("networkidle");
  check("anonymous entry can be rejected", await seen(page.getByText("Entry rejected."), 20000));

  await signOut(page);
  await page.goto(`${BASE}/track`);
  const trackBody = await page.textContent("body");
  check(
    "tracking shows the anonymous rejection reason",
    trackBody.includes("Returned by the USC administrator:") && trackBody.includes(anonRejectReason),
  );

  // 9. Admin console
  await login(page, ADMIN.username, ADMIN.password);
  await page.goto(`${BASE}/admin`);
  const adminBody = await page.textContent("body");
  check("admin overview renders", adminBody.includes("Overview") && adminBody.includes("System console"));
  check(
    "admin overview shows the status summary cards",
    adminBody.includes("Pending review") && adminBody.includes("Safety flags") && adminBody.includes("Post status"),
  );
  check(
    "admin console has a back button",
    (await page.getByRole("button", { name: "Go back" }).count()) === 1,
  );

  await page.goto(`${BASE}/admin/outbox`);
  check("outbox has local messages", (await page.textContent("body")).includes("Local outbox"));
  await page.goto(`${BASE}/admin/users`);
  check("admin user directory renders", (await page.textContent("body")).includes("Registered users"));

  // Event publishing is an administrator-only surface.
  await page.goto(`${BASE}/admin/events/new`);
  check(
    "admin can open the event publishing form",
    (await page.textContent("body")).includes("Publish an event"),
  );
  await page.goto(`${BASE}/events`);
  check(
    "admin sees the publish action on events",
    (await page.getByRole("link", { name: "Publish" }).count()) > 0,
  );

  await page.goto(`${BASE}/admin/posts?q=${encodeURIComponent(rejectTitle)}`);
  check(
    "admin can search all posts",
    (await page.textContent("body")).includes(rejectTitle),
  );
  await page.goto(`${BASE}/admin/posts?q=${encodeURIComponent(`no-such-post-${stamp}`)}`);
  check("admin post search reports no matches", (await page.textContent("body")).includes("No posts"));
  await page.goto(`${BASE}/admin/posts`);
  check(
    "admin post filters list every category",
    (await page.getByRole("navigation", { name: "Filter by category" }).getByRole("link").count()) >= 10,
  );

  await page.goto(`${BASE}/admin/safety`);
  const safetyReveal = page.getByText("See all filtered words");
  check("safety hides the word list behind a button", await seen(safetyReveal, 5000));
  await safetyReveal.click();
  const safetyText = await page.textContent("body");
  check(
    "safety button reveals the added and built-in filtered words",
    safetyText.includes("Added by admin") && safetyText.includes("Built-in") && safetyText.includes("putangina"),
  );
  check(
    "safety scan button covers posts, comments and accounts",
    await seen(page.getByRole("button", { name: "Scan all posts, comments & accounts" }), 5000),
  );
  check(
    "safety page explains comment scanning",
    safetyText.includes("posts, comments, and account names"),
  );

  await page.goto(`${BASE}/admin/insights`);
  const insightsBody = await page.textContent("body");
  check(
    "admin insights render local charts",
    insightsBody.includes("Posts by category") &&
      insightsBody.includes("New posts per week") &&
      insightsBody.includes("Export for the evaluation chapter"),
  );

  const exportResponse = await page.request.get(`${BASE}/api/admin/export/entries`);
  const exportBody = await exportResponse.text();
  check(
    "admin can export entries as CSV",
    Boolean(exportResponse.headers()["content-type"]?.includes("text/csv")) &&
      exportBody.trimStart().startsWith("id,title,status"),
  );

  // 10. Activity tab compiles reactions and post tracking
  await signOut(page);
  await login(page, ACTIVITY.email);
  await page.goto(`${BASE}/me?tab=activity`);
  const activityBody = await page.textContent("body");
  check(
    "activity tab compiles social reactions",
    /\d+ likes?( and \d+ reposts?)? on your post/.test(activityBody) &&
      /\d+ reposts?|reposted your post|\d+ repl(y|ies) on your post|replied to your post/.test(activityBody),
  );
  check("activity tab shows post tracking", activityBody.includes("Your post is now published"));

  // 11. Guard: student cannot open the admin console or publish events
  await signOut(page);
  await loginAs(page, S.guard);
  await page.goto(`${BASE}/admin`);
  check("student blocked from admin console", !(await page.textContent("body")).includes("System console"));
  await page.goto(`${BASE}/admin/events/new`);
  check(
    "student blocked from event publishing",
    !(await page.textContent("body")).includes("Publish an event"),
  );
  await page.goto(`${BASE}/events`);
  check(
    "student does not see the publish action on events",
    (await page.getByRole("link", { name: "Publish" }).count()) === 0,
  );
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.error("FAILED:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
