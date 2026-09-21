import { NextRequest, NextResponse } from "next/server";

const SITES = [
  // Соцсети
  { name: "GitHub", url: (u: string) => `https://github.com/${u}` },
  { name: "Reddit", url: (u: string) => `https://www.reddit.com/user/${u}` },
  { name: "X (Twitter)", url: (u: string) => `https://x.com/${u}` },
  { name: "Instagram", url: (u: string) => `https://www.instagram.com/${u}` },
  { name: "TikTok", url: (u: string) => `https://www.tiktok.com/@${u}` },
  { name: "Facebook", url: (u: string) => `https://www.facebook.com/${u}` },
  { name: "Telegram", url: (u: string) => `https://t.me/${u}` },
  { name: "VK", url: (u: string) => `https://vk.com/${u}` },
  { name: "Pinterest", url: (u: string) => `https://www.pinterest.com/${u}` },
  { name: "LinkedIn", url: (u: string) => `https://www.linkedin.com/in/${u}` },
  { name: "Threads", url: (u: string) => `https://www.threads.net/@${u}` },
  { name: "Tumblr", url: (u: string) => `https://${u}.tumblr.com` },
  { name: "Snapchat", url: (u: string) => `https://www.snapchat.com/add/${u}` },
  { name: "Mastodon", url: (u: string) => `https://mastodon.social/@${u}` },
  { name: "Bluesky", url: (u: string) => `https://bsky.app/profile/${u}.bsky.social` },
  { name: "Myspace", url: (u: string) => `https://myspace.com/${u}` },
  { name: "Odnoklassniki", url: (u: string) => `https://ok.ru/${u}` },
  { name: "Discord (Lookup)", url: (u: string) => `https://discord.com/users/${u}` },
  { name: "Signal", url: (u: string) => `https://signal.me/#p/${u}` },

  // Видео/аудио
  { name: "YouTube", url: (u: string) => `https://www.youtube.com/@${u}` },
  { name: "Twitch", url: (u: string) => `https://www.twitch.tv/${u}` },
  { name: "SoundCloud", url: (u: string) => `https://soundcloud.com/${u}` },
  { name: "Spotify", url: (u: string) => `https://open.spotify.com/user/${u}` },
  { name: "Last.fm", url: (u: string) => `https://www.last.fm/user/${u}` },
  { name: "Vimeo", url: (u: string) => `https://vimeo.com/${u}` },
  { name: "Bandcamp", url: (u: string) => `https://${u}.bandcamp.com` },
  { name: "Mixcloud", url: (u: string) => `https://www.mixcloud.com/${u}` },
  { name: "DailyMotion", url: (u: string) => `https://www.dailymotion.com/${u}` },
  { name: "Rumble", url: (u: string) => `https://rumble.com/user/${u}` },
  { name: "Kick", url: (u: string) => `https://kick.com/${u}` },

  // Код и разработка
  { name: "GitLab", url: (u: string) => `https://gitlab.com/${u}` },
  { name: "Bitbucket", url: (u: string) => `https://bitbucket.org/${u}` },
  { name: "npm", url: (u: string) => `https://www.npmjs.com/~${u}` },
  { name: "PyPI", url: (u: string) => `https://pypi.org/user/${u}` },
  { name: "Docker Hub", url: (u: string) => `https://hub.docker.com/u/${u}` },
  { name: "CodePen", url: (u: string) => `https://codepen.io/${u}` },
  { name: "Replit", url: (u: string) => `https://replit.com/@${u}` },
  { name: "Kaggle", url: (u: string) => `https://www.kaggle.com/${u}` },
  { name: "Product Hunt", url: (u: string) => `https://www.producthunt.com/@${u}` },
  { name: "Hacker News", url: (u: string) => `https://news.ycombinator.com/user?id=${u}` },
  { name: "Keybase", url: (u: string) => `https://keybase.io/${u}` },
  { name: "HackerRank", url: (u: string) => `https://www.hackerrank.com/${u}` },
  { name: "LeetCode", url: (u: string) => `https://leetcode.com/${u}` },
  { name: "Codeforces", url: (u: string) => `https://codeforces.com/profile/${u}` },
  { name: "Stack Overflow", url: (u: string) => `https://stackoverflow.com/users/${u}` },
  { name: "SourceForge", url: (u: string) => `https://sourceforge.net/u/${u}` },
  { name: "Trello", url: (u: string) => `https://trello.com/${u}` },
  { name: "CodeSandbox", url: (u: string) => `https://codesandbox.io/u/${u}` },
  { name: "Glitch", url: (u: string) => `https://glitch.com/@${u}` },
  { name: "RubyGems", url: (u: string) => `https://rubygems.org/profiles/${u}` },
  { name: "Crates.io", url: (u: string) => `https://crates.io/users/${u}` },
  { name: "NuGet", url: (u: string) => `https://www.nuget.org/profiles/${u}` },
  { name: "Packagist", url: (u: string) => `https://packagist.org/packages/${u}` },
  { name: "Observable", url: (u: string) => `https://observablehq.com/@${u}` },

  // Дизайн/творчество
  { name: "Behance", url: (u: string) => `https://www.behance.net/${u}` },
  { name: "Dribbble", url: (u: string) => `https://dribbble.com/${u}` },
  { name: "DeviantArt", url: (u: string) => `https://www.deviantart.com/${u}` },
  { name: "Flickr", url: (u: string) => `https://www.flickr.com/people/${u}` },
  { name: "Imgur", url: (u: string) => `https://imgur.com/user/${u}` },
  { name: "ArtStation", url: (u: string) => `https://www.artstation.com/${u}` },
  { name: "500px", url: (u: string) => `https://500px.com/p/${u}` },
  { name: "Unsplash", url: (u: string) => `https://unsplash.com/@${u}` },
  { name: "Giphy", url: (u: string) => `https://giphy.com/${u}` },
  { name: "Newgrounds", url: (u: string) => `https://${u}.newgrounds.com` },
  { name: "Redbubble", url: (u: string) => `https://www.redbubble.com/people/${u}` },
  { name: "Canva", url: (u: string) => `https://www.canva.com/${u}` },

  // Тексты/книги/блоги
  { name: "Medium", url: (u: string) => `https://medium.com/@${u}` },
  { name: "Goodreads", url: (u: string) => `https://www.goodreads.com/${u}` },
  { name: "Letterboxd", url: (u: string) => `https://letterboxd.com/${u}` },
  { name: "WordPress", url: (u: string) => `https://${u}.wordpress.com` },
  { name: "Blogger", url: (u: string) => `https://${u}.blogspot.com` },
  { name: "Substack", url: (u: string) => `https://${u}.substack.com` },
  { name: "Wattpad", url: (u: string) => `https://www.wattpad.com/user/${u}` },
  { name: "Quora", url: (u: string) => `https://www.quora.com/profile/${u}` },
  { name: "Dev.to", url: (u: string) => `https://dev.to/${u}` },
  { name: "Hashnode", url: (u: string) => `https://hashnode.com/@${u}` },
  { name: "AO3", url: (u: string) => `https://archiveofourown.org/users/${u}` },
  { name: "Genius", url: (u: string) => `https://genius.com/${u}` },

  // Игры
  { name: "Steam", url: (u: string) => `https://steamcommunity.com/id/${u}` },
  { name: "Chess.com", url: (u: string) => `https://www.chess.com/member/${u}` },
  { name: "Lichess", url: (u: string) => `https://lichess.org/@/${u}` },
  { name: "Roblox", url: (u: string) => `https://www.roblox.com/user.aspx?username=${u}` },
  { name: "Xbox Gamertag", url: (u: string) => `https://xboxgamertag.com/search/${u}` },
  { name: "osu!", url: (u: string) => `https://osu.ppy.sh/users/${u}` },
  { name: "itch.io", url: (u: string) => `https://${u}.itch.io` },
  { name: "Speedrun.com", url: (u: string) => `https://www.speedrun.com/user/${u}` },

  // Финансы/крипта
  { name: "GitHub Gist", url: (u: string) => `https://gist.github.com/${u}` },
  { name: "OpenSea", url: (u: string) => `https://opensea.io/${u}` },
  { name: "Cash App", url: (u: string) => `https://cash.app/$${u}` },
  { name: "Venmo", url: (u: string) => `https://venmo.com/${u}` },

  // Форумы/сообщества
  { name: "About.me", url: (u: string) => `https://about.me/${u}` },
  { name: "Disqus", url: (u: string) => `https://disqus.com/by/${u}` },
  { name: "Slideshare", url: (u: string) => `https://www.slideshare.net/${u}` },
  { name: "Patreon", url: (u: string) => `https://www.patreon.com/${u}` },
  { name: "Ko-fi", url: (u: string) => `https://ko-fi.com/${u}` },
  { name: "Buy Me a Coffee", url: (u: string) => `https://www.buymeacoffee.com/${u}` },
  { name: "Linktree", url: (u: string) => `https://linktr.ee/${u}` },
  { name: "Gravatar", url: (u: string) => `https://gravatar.com/${u}` },
  { name: "AngelList/Wellfound", url: (u: string) => `https://wellfound.com/u/${u}` },
  { name: "Fiverr", url: (u: string) => `https://www.fiverr.com/${u}` },
  { name: "Upwork", url: (u: string) => `https://www.upwork.com/freelancers/~${u}` },
  { name: "Etsy", url: (u: string) => `https://www.etsy.com/shop/${u}` },
  { name: "eBay", url: (u: string) => `https://www.ebay.com/usr/${u}` },
  { name: "TripAdvisor", url: (u: string) => `https://www.tripadvisor.com/members/${u}` },
  { name: "Houzz", url: (u: string) => `https://www.houzz.com/user/${u}` },
  { name: "Untappd", url: (u: string) => `https://untappd.com/user/${u}` },
  { name: "Strava", url: (u: string) => `https://www.strava.com/athletes/${u}` },
  { name: "MyAnimeList", url: (u: string) => `https://myanimelist.net/profile/${u}` },
  { name: "AniList", url: (u: string) => `https://anilist.co/user/${u}` },
  { name: "Trakt", url: (u: string) => `https://trakt.tv/users/${u}` },
  { name: "IMDb", url: (u: string) => `https://www.imdb.com/user/${u}` },
  { name: "Duolingo", url: (u: string) => `https://www.duolingo.com/profile/${u}` },
  { name: "Coursera", url: (u: string) => `https://www.coursera.org/user/${u}` },
  { name: "freeCodeCamp", url: (u: string) => `https://www.freecodecamp.org/${u}` },
  { name: "Buzzfeed", url: (u: string) => `https://www.buzzfeed.com/${u}` },
  { name: "Reverbnation", url: (u: string) => `https://www.reverbnation.com/${u}` },
  { name: "Периscope", url: (u: string) => `https://www.pscp.tv/${u}` },
  { name: "Xanga", url: (u: string) => `https://${u}.xanga.com` },
  { name: "LiveJournal", url: (u: string) => `https://${u}.livejournal.com` },
  { name: "4chan (archive check)", url: (u: string) => `https://find.4chan.org/?q=${u}` },
  { name: "Ravelry", url: (u: string) => `https://www.ravelry.com/people/${u}` },
  { name: "Houzz Ideabooks", url: (u: string) => `https://www.houzz.com/ideabooks/user/${u}` },
  { name: "SlideShare Profile", url: (u: string) => `https://www.slideshare.net/${u}` },
  { name: "Threadless", url: (u: string) => `https://${u}.threadless.com` },
  { name: "Bandsintown", url: (u: string) => `https://www.bandsintown.com/${u}` },
  { name: "Discogs", url: (u: string) => `https://www.discogs.com/user/${u}` },
];

export async function POST(request: NextRequest) {
  const { username } = await request.json();

  const checks = SITES.map(async (site) => {
    const url = site.url(username);
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(4000),
      });
      const found = res.status === 200;
      return { name: site.name, url, found };
    } catch {
      return { name: site.name, url, found: false };
    }
  });

  const results = await Promise.all(checks);
  return NextResponse.json({ results });
}