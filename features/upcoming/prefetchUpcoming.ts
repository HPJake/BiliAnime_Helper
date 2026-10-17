import type { AnimeService } from "../../services/anime/AnimeService";
import { getAnimeSeason, getLocalCalendarRange } from "../calendar/calendar";

export async function prefetchUpcoming(
  animeService: AnimeService,
  now = new Date()
): Promise<void> {
  const range = getLocalCalendarRange(now);
  const season = getAnimeSeason(now);
  await animeService.getUpcomingAnimeSchedule(
    range.from,
    range.to,
    season.season,
    season.year
  );
}
