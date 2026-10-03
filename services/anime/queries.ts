const ANIME_FIELDS = `
  id
  title { romaji english native }
  synonyms
  coverImage { extraLarge large medium }
  episodes
  status
  season
  seasonYear
  popularity
  trending
  isAdult
  nextAiringEpisode { mediaId episode airingAt }
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

export const TRENDING_ANIME_QUERY = `
  query TrendingAnime($perPage: Int!) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, isAdult: false, sort: TRENDING_DESC) {
        ${ANIME_FIELDS}
      }
    }
  }
`;
