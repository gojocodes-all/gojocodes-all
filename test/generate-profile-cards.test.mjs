import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateStreaks,
  normalizeProfile,
  renderActivity,
  renderOverview,
} from '../scripts/generate-profile-cards.mjs';

function dateFromToday(offset) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function profileFixture(overrides = {}) {
  return {
    activeDays: 2,
    calendar: {
      weeks: [
        {
          firstDay: '2026-09-13',
          contributionDays: [
            { contributionCount: 2, date: '2026-09-13' },
            { contributionCount: 0, date: '2026-09-14' },
          ],
        },
      ],
    },
    currentStreak: 1,
    longestStreak: 2,
    profileDate: '2026-09-14',
    publicRepos: 3,
    pullRequests: 4,
    stars: 5,
    totalContributions: 6,
    username: 'gojocodes-all',
    ...overrides,
  };
}

test('calculateStreaks keeps an active streak open while today is unfinished', () => {
  const days = [
    { contributionCount: 0, date: dateFromToday(-4) },
    { contributionCount: 1, date: dateFromToday(-3) },
    { contributionCount: 2, date: dateFromToday(-2) },
    { contributionCount: 1, date: dateFromToday(-1) },
    { contributionCount: 0, date: dateFromToday(0) },
  ];

  assert.deepEqual(calculateStreaks(days), {
    activeDays: 3,
    current: 3,
    longest: 3,
  });
});

test('calculateStreaks stops the current streak at a completed inactive day', () => {
  const days = [
    { contributionCount: 2, date: dateFromToday(-2) },
    { contributionCount: 0, date: dateFromToday(-1) },
    { contributionCount: 0, date: dateFromToday(0) },
  ];

  assert.equal(calculateStreaks(days).current, 0);
});

test('normalizeProfile excludes private repositories from public totals', () => {
  const user = {
    login: 'gojocodes-all',
    repositories: {
      nodes: [
        { isPrivate: false, stargazerCount: 3 },
        { isPrivate: true, stargazerCount: 20 },
        { isPrivate: false, stargazerCount: 2 },
      ],
    },
    pullRequests: { totalCount: 7 },
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: 9,
        weeks: [
          {
            firstDay: dateFromToday(-1),
            contributionDays: [
              { contributionCount: 1, date: dateFromToday(-1) },
              { contributionCount: 0, date: dateFromToday(0) },
            ],
          },
        ],
      },
    },
  };

  const profile = normalizeProfile(user);

  assert.equal(profile.publicRepos, 2);
  assert.equal(profile.stars, 5);
  assert.equal(profile.pullRequests, 7);
  assert.equal(profile.totalContributions, 9);
});

test('renderOverview escapes user-controlled text and includes accessible metadata', () => {
  const svg = renderOverview(profileFixture({ username: 'gojo<&"' }));

  assert.match(svg, /<title id="title">/);
  assert.match(svg, /<desc id="desc">/);
  assert.match(svg, /@gojo&lt;&amp;&quot;/);
  assert.doesNotMatch(svg, /@gojo<&"/);
});

test('renderOverview supports the mobile card dimensions', () => {
  const svg = renderOverview(profileFixture(), true);

  assert.match(svg, /width="720" height="520"/);
  assert.match(svg, /PUBLIC REPOSITORIES/);
});

test('renderActivity describes the rendered weekly data', () => {
  const svg = renderActivity(profileFixture());

  assert.match(svg, /weekly contribution activity/);
  assert.match(svg, /2 contributions across the 1 weeks shown/);
  assert.match(svg, /WEEKLY PUBLIC CONTRIBUTIONS/);
});
