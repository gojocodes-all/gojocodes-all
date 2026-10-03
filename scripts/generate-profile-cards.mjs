import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_URL = 'https://api.github.com/graphql';
const OUTPUT_DIR = 'dist';
const GREEN = '#22ff88';
const BACKGROUND = '#0d1117';
const SURFACE = '#161b22';
const BORDER = '#30363d';
const TEXT = '#f0f6fc';
const MUTED = '#8b949e';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS = 'Arial, Helvetica, sans-serif';

const PROFILE_QUERY = `
  query ProfileGraphics($login: String!) {
    user(login: $login) {
      login
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        nodes {
          isPrivate
          stargazerCount
        }
      }
      pullRequests(first: 1) {
        totalCount
      }
      contributionsCollection {
        joinedGitHubContribution {
          occurredAt
        }
        restrictedContributionsCount
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalRepositoryContributions
        contributionCalendar {
          totalContributions
          weeks {
            firstDay
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    }
  }
`;

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-GB').format(Number(value) || 0);
}

function formatCount(value, singular, plural = `${singular}S`) {
  return `${formatNumber(value)} ${Number(value) === 1 ? singular : plural}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function flattenDays(calendar) {
  return calendar.weeks
    .flatMap((week) => week.contributionDays)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function calculateStreaks(days) {
  let longest = 0;
  let run = 0;
  let activeDays = 0;

  for (const day of days) {
    if (day.contributionCount > 0) {
      run += 1;
      activeDays += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  let cursor = days.findLastIndex((day) => day.date <= today);

  // A zero today does not break the visible streak until the day is over.
  if (cursor >= 0 && days[cursor].date === today && days[cursor].contributionCount === 0) {
    cursor -= 1;
  }

  let current = 0;
  while (cursor >= 0 && days[cursor].contributionCount > 0) {
    current += 1;
    cursor -= 1;
  }

  return { activeDays, current, longest };
}

function normalizeProfile(user) {
  const contributions = user.contributionsCollection;
  const calendar = contributions.contributionCalendar;
  const days = flattenDays(calendar);
  const publicRepositories = user.repositories.nodes.filter((repository) => !repository.isPrivate);
  const streaks = calculateStreaks(days);

  return {
    activeDays: streaks.activeDays,
    calendar,
    commitContributions: contributions.totalCommitContributions ?? 0,
    currentStreak: streaks.current,
    issueContributions: contributions.totalIssueContributions ?? 0,
    joinedContributions: contributions.joinedGitHubContribution ? 1 : 0,
    longestStreak: streaks.longest,
    profileDate: days.at(-1)?.date ?? new Date().toISOString().slice(0, 10),
    publicRepos: publicRepositories.length,
    pullRequests: user.pullRequests.totalCount,
    pullRequestContributions: contributions.totalPullRequestContributions ?? 0,
    restrictedContributions: contributions.restrictedContributionsCount ?? 0,
    repositoryContributions: contributions.totalRepositoryContributions ?? 0,
    reviewContributions: contributions.totalPullRequestReviewContributions ?? 0,
    stars: publicRepositories.reduce((total, repository) => total + repository.stargazerCount, 0),
    totalContributions: calendar.totalContributions,
    username: user.login,
  };
}

function metric({ label, value, x, y, valueSize = 38 }) {
  return `
    <text x="${x}" y="${y}" fill="${TEXT}" font-family="${SANS}" font-size="${valueSize}" font-weight="700">${escapeXml(formatNumber(value))}</text>
    <text x="${x}" y="${y + 27}" fill="${MUTED}" font-family="${MONO}" font-size="12" letter-spacing="1.1">${escapeXml(label)}</text>`;
}

function svgShell({ width, height, title, description, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">${escapeXml(description)}</desc>
  <rect width="${width}" height="${height}" rx="10" fill="${BACKGROUND}"/>
  <rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="9.5" fill="none" stroke="${BORDER}"/>
  <rect width="${width}" height="4" fill="${GREEN}"/>
  ${body}
</svg>`;
}

function renderOverview(profile, mobile = false) {
  const updated = escapeXml(profile.profileDate);
  const privateMix = profile.restrictedContributions > 0
    ? ` · ${formatNumber(profile.restrictedContributions)} PRIVATE`
    : '';
  const joinedMix = profile.joinedContributions > 0
    ? ` · ${formatCount(profile.joinedContributions, 'JOIN')}`
    : '';
  const mix = `${formatCount(profile.commitContributions, 'COMMIT')} · ${formatCount(profile.pullRequestContributions, 'PR')} · ${formatCount(profile.issueContributions, 'ISSUE')} · ${formatCount(profile.reviewContributions, 'REVIEW')} · ${formatCount(profile.repositoryContributions, 'REPO')}${privateMix}${joinedMix}`;

  if (mobile) {
    return svgShell({
      width: 720,
      height: 560,
      title: `${profile.username} GitHub statistics and contribution streak`,
      description: `Current profile snapshot with ${profile.totalContributions} contributions in the visible year and a current streak of ${profile.currentStreak} days.`,
      body: `
        <text x="40" y="45" fill="${GREEN}" font-family="${MONO}" font-size="15" letter-spacing="1.5">GITHUB / LIVE SNAPSHOT</text>
        <text x="680" y="45" fill="${MUTED}" text-anchor="end" font-family="${MONO}" font-size="14">@${escapeXml(profile.username)}</text>
        <line x1="40" y1="68" x2="680" y2="68" stroke="${BORDER}"/>

        ${metric({ label: 'CONTRIBUTIONS / 365D', value: profile.totalContributions, x: 40, y: 132, valueSize: 40 })}
        ${metric({ label: 'PUBLIC REPOSITORIES', value: profile.publicRepos, x: 390, y: 132, valueSize: 40 })}
        ${metric({ label: 'STARS EARNED', value: profile.stars, x: 40, y: 232, valueSize: 40 })}
        ${metric({ label: 'PULL REQUESTS', value: profile.pullRequests, x: 390, y: 232, valueSize: 40 })}

        <line x1="40" y1="286" x2="680" y2="286" stroke="${BORDER}"/>
        <text x="40" y="327" fill="${GREEN}" font-family="${MONO}" font-size="14" letter-spacing="1.4">CONTRIBUTION STREAK</text>
        ${metric({ label: 'CURRENT', value: profile.currentStreak, x: 40, y: 399, valueSize: 58 })}
        ${metric({ label: 'BEST / 365D', value: profile.longestStreak, x: 285, y: 399, valueSize: 42 })}
        ${metric({ label: 'ACTIVE DAYS', value: profile.activeDays, x: 510, y: 399, valueSize: 42 })}

        <line x1="40" y1="468" x2="680" y2="468" stroke="${BORDER}"/>
        <text x="40" y="502" fill="${TEXT}" font-family="${MONO}" font-size="11">MIX / 365D · ${escapeXml(mix)}</text>
        <text x="40" y="535" fill="${MUTED}" font-family="${MONO}" font-size="12">30-MIN REFRESH SCHEDULE · DATA THROUGH ${updated}</text>`,
    });
  }

  return svgShell({
    width: 1200,
    height: 280,
    title: `${profile.username} GitHub statistics and contribution streak`,
    description: `Current profile snapshot with ${profile.totalContributions} contributions in the visible year and a current streak of ${profile.currentStreak} days.`,
    body: `
      <text x="42" y="42" fill="${GREEN}" font-family="${MONO}" font-size="14" letter-spacing="1.5">GITHUB / LIVE SNAPSHOT</text>
      <text x="1158" y="42" fill="${MUTED}" text-anchor="end" font-family="${MONO}" font-size="13">@${escapeXml(profile.username)}</text>
      <line x1="42" y1="63" x2="1158" y2="63" stroke="${BORDER}"/>

      ${metric({ label: 'CONTRIBUTIONS / 365D', value: profile.totalContributions, x: 42, y: 132 })}
      ${metric({ label: 'PUBLIC REPOS', value: profile.publicRepos, x: 232, y: 132 })}
      ${metric({ label: 'STARS EARNED', value: profile.stars, x: 365, y: 132 })}
      ${metric({ label: 'PULL REQUESTS', value: profile.pullRequests, x: 535, y: 132 })}

      <line x1="704" y1="86" x2="704" y2="223" stroke="${BORDER}"/>
      <text x="752" y="102" fill="${GREEN}" font-family="${MONO}" font-size="13" letter-spacing="1.4">CONTRIBUTION STREAK</text>
      ${metric({ label: 'CURRENT', value: profile.currentStreak, x: 752, y: 174, valueSize: 58 })}
      ${metric({ label: 'BEST / 365D', value: profile.longestStreak, x: 930, y: 164, valueSize: 37 })}
      ${metric({ label: 'ACTIVE DAYS', value: profile.activeDays, x: 1060, y: 164, valueSize: 37 })}

      <text x="42" y="250" fill="${TEXT}" font-family="${MONO}" font-size="11">MIX / 365D · ${escapeXml(mix)}</text>
      <text x="1158" y="250" fill="${MUTED}" text-anchor="end" font-family="${MONO}" font-size="11">30-MIN SCHEDULE · THROUGH ${updated}</text>`,
  });
}

function selectDays(calendar, count) {
  return flattenDays(calendar).slice(-count);
}

function selectWeeks(calendar, count) {
  return calendar.weeks.slice(-count).map((week) => ({
    date: week.firstDay,
    total: week.contributionDays.reduce((sum, day) => sum + day.contributionCount, 0),
  }));
}

function renderDailyActivity(profile, mobile = false) {
  const width = mobile ? 720 : 1200;
  const height = mobile ? 430 : 340;
  const days = selectDays(profile.calendar, 30);
  const left = mobile ? 54 : 68;
  const right = mobile ? 680 : 1150;
  const top = mobile ? 98 : 92;
  const bottom = mobile ? 342 : 270;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const maximum = Math.max(1, ...days.map((day) => day.contributionCount));
  const slotWidth = plotWidth / Math.max(1, days.length);
  const barWidth = Math.max(4, slotWidth * (mobile ? 0.62 : 0.68));
  const total = days.reduce((sum, day) => sum + day.contributionCount, 0);
  const activeDays = days.filter((day) => day.contributionCount > 0).length;
  const peak = days.reduce(
    (best, day) => (day.contributionCount > best.contributionCount ? day : best),
    days[0] ?? { contributionCount: 0, date: profile.profileDate },
  );

  const horizontalGrid = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    const y = top + plotHeight * ratio;
    const label = Math.round(maximum * (1 - ratio));
    return `<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="${BORDER}" stroke-opacity=".75"/>
      <text x="${left - 12}" y="${(y + 4).toFixed(1)}" fill="${MUTED}" text-anchor="end" font-family="${MONO}" font-size="11">${label}</text>`;
  }).join('\n');

  const bars = days.map((day, index) => {
    const heightValue = day.contributionCount === 0 ? 2 : (plotHeight * day.contributionCount) / maximum;
    const x = left + slotWidth * index + (slotWidth - barWidth) / 2;
    const y = bottom - heightValue;
    const opacity = day.contributionCount === 0 ? 0.22 : 0.72 + (0.28 * day.contributionCount) / maximum;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${heightValue.toFixed(1)}" rx="2" fill="${GREEN}" fill-opacity="${opacity.toFixed(2)}"/>`;
  }).join('');

  const labelIndexes = [...new Set([0, Math.floor((days.length - 1) / 3), Math.floor(((days.length - 1) * 2) / 3), days.length - 1])];
  const dateLabels = labelIndexes.map((index) => {
    const x = left + slotWidth * index + slotWidth / 2;
    return `<text x="${x.toFixed(1)}" y="${bottom + 28}" fill="${MUTED}" text-anchor="middle" font-family="${MONO}" font-size="11">${escapeXml(formatDate(days[index].date))}</text>`;
  }).join('');

  return svgShell({
    width,
    height,
    title: `${profile.username} daily contribution activity`,
    description: `${total} contributions across the ${days.length} days shown in this graph.`,
    body: `
      <text x="${mobile ? 38 : 42}" y="43" fill="${GREEN}" font-family="${MONO}" font-size="14" letter-spacing="1.5">DAILY PULSE / ${days.length} DAYS</text>
      <text x="${width - (mobile ? 38 : 42)}" y="43" fill="${MUTED}" text-anchor="end" font-family="${MONO}" font-size="13">${formatNumber(total)} IN VIEW</text>
      <line x1="${mobile ? 38 : 42}" y1="64" x2="${width - (mobile ? 38 : 42)}" y2="64" stroke="${BORDER}"/>
      ${horizontalGrid}
      ${bars}
      ${dateLabels}
      <text x="${left}" y="${height - 20}" fill="${MUTED}" font-family="${MONO}" font-size="11">ACTIVE ${activeDays}/${days.length} DAYS · PEAK ${formatNumber(peak.contributionCount)} ON ${escapeXml(formatDate(peak.date))}</text>`,
  });
}

function renderWeeklyActivity(profile, mobile = false) {
  const width = mobile ? 720 : 1200;
  const height = mobile ? 430 : 340;
  const weeks = selectWeeks(profile.calendar, 30);
  const left = mobile ? 54 : 68;
  const right = mobile ? 680 : 1150;
  const top = mobile ? 98 : 92;
  const bottom = mobile ? 342 : 270;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const maximum = Math.max(1, ...weeks.map((week) => week.total));
  const xAt = (index) => left + (plotWidth * index) / Math.max(1, weeks.length - 1);
  const yAt = (value) => bottom - (plotHeight * value) / maximum;
  const points = weeks.map((week, index) => [xAt(index), yAt(week.total)]);
  const linePath = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${right} ${bottom} L${left} ${bottom} Z`;
  const total = weeks.reduce((sum, week) => sum + week.total, 0);

  const horizontalGrid = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    const y = top + plotHeight * ratio;
    const label = Math.round(maximum * (1 - ratio));
    return `<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="${BORDER}" stroke-opacity=".75"/>
      <text x="${left - 12}" y="${(y + 4).toFixed(1)}" fill="${MUTED}" text-anchor="end" font-family="${MONO}" font-size="11">${label}</text>`;
  }).join('\n');

  const labelIndexes = [...new Set([0, Math.floor((weeks.length - 1) / 3), Math.floor(((weeks.length - 1) * 2) / 3), weeks.length - 1])];
  const dateLabels = labelIndexes.map((index) => `
    <text x="${xAt(index).toFixed(1)}" y="${bottom + 28}" fill="${MUTED}" text-anchor="middle" font-family="${MONO}" font-size="11">${escapeXml(formatDate(weeks[index].date))}</text>`).join('');
  const dots = points.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${mobile ? 3.5 : 3}" fill="${BACKGROUND}" stroke="${GREEN}" stroke-width="2"/>`).join('');

  return svgShell({
    width,
    height,
    title: `${profile.username} weekly contribution activity`,
    description: `${total} contributions across the ${weeks.length} weeks shown in this graph.`,
    body: `
      <text x="${mobile ? 38 : 42}" y="43" fill="${GREEN}" font-family="${MONO}" font-size="14" letter-spacing="1.5">WEEKLY RHYTHM / ${weeks.length} WEEKS</text>
      <text x="${width - (mobile ? 38 : 42)}" y="43" fill="${MUTED}" text-anchor="end" font-family="${MONO}" font-size="13">${formatNumber(total)} IN VIEW</text>
      <line x1="${mobile ? 38 : 42}" y1="64" x2="${width - (mobile ? 38 : 42)}" y2="64" stroke="${BORDER}"/>
      ${horizontalGrid}
      <path d="${areaPath}" fill="${GREEN}" fill-opacity=".08"/>
      <path d="${linePath}" fill="none" stroke="${GREEN}" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"/>
      ${dots}
      ${dateLabels}
      <text x="${left}" y="${height - 20}" fill="${MUTED}" font-family="${MONO}" font-size="11">WEEKLY PUBLIC CONTRIBUTIONS</text>`,
  });
}

async function fetchProfile(username, token) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'gojocodes-all-profile-graphics',
    },
    body: JSON.stringify({ query: PROFILE_QUERY, variables: { login: username } }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${payload.errors.map((error) => error.message).join('; ')}`);
  }
  if (!payload.data?.user) {
    throw new Error(`GitHub user ${username} was not found.`);
  }

  return normalizeProfile(payload.data.user);
}

async function main() {
  const username = process.env.GITHUB_USERNAME || process.env.GITHUB_REPOSITORY_OWNER;
  const token = process.env.GITHUB_TOKEN;

  if (!username) throw new Error('GITHUB_USERNAME or GITHUB_REPOSITORY_OWNER is required.');
  if (!token) throw new Error('GITHUB_TOKEN is required.');

  const profile = await fetchProfile(username, token);
  const files = {
    'profile-daily-mobile.svg': renderDailyActivity(profile, true),
    'profile-daily.svg': renderDailyActivity(profile),
    'profile-overview-mobile.svg': renderOverview(profile, true),
    'profile-overview.svg': renderOverview(profile),
    'profile-weekly-mobile.svg': renderWeeklyActivity(profile, true),
    'profile-weekly.svg': renderWeeklyActivity(profile),
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await Promise.all(
    Object.entries(files).map(([name, contents]) =>
      writeFile(path.join(OUTPUT_DIR, name), `${contents}\n`, 'utf8'),
    ),
  );

  console.log(`Generated ${Object.keys(files).length} profile graphics for ${profile.username}.`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export {
  calculateStreaks,
  normalizeProfile,
  renderDailyActivity,
  renderOverview,
  renderWeeklyActivity,
};
