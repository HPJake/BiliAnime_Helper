const ANIME_FIELDS = `
  id
  title { romaji english native }
  synonyms
  coverImage { extraLarge large medium }
  description(asHtml: false)
  episodes
  format
  genres
  averageScore
  status
  season
  seasonYear
  popularity
  trending
  isAdult
  nextAiringEpisode { mediaId episode airingAt }
`;

export const RANDOM_ANIME_QUERY = `
  query RandomAnime($year: String!, $excludedId: Int) {
    Page(page: 1, perPage: 50) {
      media(
        type: ANIME
        isAdult: false
        id_not: $excludedId
        startDate_like: $year
        countryOfOrigin: JP
        format_in: [TV, TV_SHORT, MOVIE, OVA, ONA, SPECIAL]
        sort: [POPULARITY_DESC, SCORE_DESC]
      ) {
        ${ANIME_FIELDS}
      }
    }
  }
`;

export const SEARCH_ANIME_QUERY = `
  query SearchAnime($search: String!, $perPage: Int!) {
    Page(page: 1, perPage: $perPage) {
      media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) {
        ${ANIME_FIELDS}
      }
    }
  }
`;

export const ANIME_BY_ID_QUERY = `
  query AnimeById($id: Int!) {
    Media(id: $id, type: ANIME) {
      ${ANIME_FIELDS}
    }
  }
`;

export const ANIME_SERIES_QUERY = `
  query AnimeSeries($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        ${ANIME_FIELDS}
        relations {
          edges {
            relationType
            node {
              ${ANIME_FIELDS}
            }
          }
        }
      }
    }
  }
`;

export const AIRING_SCHEDULE_QUERY = `
  query AiringSchedule($mediaId: Int!, $from: Int!, $to: Int!) {
    Page(page: 1, perPage: 50) {
      airingSchedules(
        mediaId: $mediaId
        airingAt_greater: $from
        airingAt_lesser: $to
        sort: TIME
      ) {
        mediaId
        episode
        airingAt
      }
    }
  }
`;

export const SEASON_ANIME_QUERY = `
  query SeasonAnime($page: Int!, $season: MediaSeason!, $seasonYear: Int!) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      media(
        type: ANIME
        season: $season
        seasonYear: $seasonYear
        countryOfOrigin: JP
        isAdult: false
        sort: POPULARITY_DESC
      ) {
        ${ANIME_FIELDS}
      }
    }
  }
`;

export const UPCOMING_AIRING_QUERY = `
  query UpcomingAiring($page: Int!, $from: Int!, $to: Int!, $mediaIds: [Int]) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      airingSchedules(
        mediaId_in: $mediaIds
        airingAt_greater: $from
        airingAt_lesser: $to
        sort: TIME
      ) {
        mediaId
        episode
        airingAt
      }
    }
  }
`;

export const TRENDING_ANIME_QUERY = `
  query TrendingAnime($perPage: Int!) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, isAdult: false, sort: TRENDING_DESC) {
        ${ANIME_FIELDS}
      }
    }
  }
`;
