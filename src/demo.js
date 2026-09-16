// Client TMDB simulé, branché par ?demo=1.
// Films réels relevés sur TMDB le 14 septembre 2026, puis figés : ce module
// ne fait aucune requête réseau et n'a besoin d'aucun identifiant.
import { hashString } from './engine.js';
import { posterUrl, movieUrl } from './tmdb.js';

const OVERVIEW = 'Mode démonstration : les données de ce film sont figées dans l\'application.';

// [id, titre, date de sortie, note, votes, genres, affiche]
const mk = ([id, title, release_date, vote_average, vote_count, genre_ids, poster_path]) => ({
  id, title, original_title: title, release_date, vote_average, vote_count,
  genre_ids, poster_path, popularity: 10, overview: OVERVIEW
});

const CITY_NIGHT_POPULAR = [
  [414906, 'The Batman', '2022-03-01', 7.7, 12495, [80, 9648, 53], '/t9JGg10CW1DzXEdWL54ewkUko6N.jpg'],
  [4935, 'Le Château ambulant', '2004-09-09', 8.4, 11427, [14, 16, 12], '/45PVXJUYfH6yIINcQKelQ0SJPvh.jpg'],
  [103, 'Taxi Driver', '1976-02-09', 8.1, 13778, [80, 18], '/iyHQrfNsjZlfHJ8hyhNi0yAFnZa.jpg'],
  [18, 'Le Cinquième Élément', '1997-05-02', 7.6, 12133, [878, 28, 12], '/8nx8sttha1Zidt73SbNncVfSwqk.jpg'],
  [4982, 'American Gangster', '2007-11-02', 7.6, 6225, [18, 80], '/bHyjYV26VTHQwzl8QiZ5IbuI7Qz.jpg'],
  [495764, 'Birds of Prey', '2020-02-05', 6.9, 10988, [28, 80], '/14DRJrjIzUE1ZtExRwTP0wOhPwG.jpg'],
  [2832, 'Identity', '2003-04-25', 7.2, 4523, [9648, 53], '/jSSgqRcLaDLh56t5ko1ywAKq0q9.jpg'],
  [627, 'Trainspotting', '1996-02-23', 8.0, 10651, [18, 80], '/wSjSdfnVjD6r8Fnn0K8FXz3JciM.jpg'],
  [1538, 'Collatéral', '2004-08-04', 7.2, 6479, [18, 80, 53], '/x6OIJWkwe6Kj4pQXTkhhBb7gluA.jpg'],
  [6075, 'L\'Impasse', '1993-11-10', 7.8, 3578, [80, 18, 53], '/cjki1jkGhrDhs9ir1dV7qsCqeXz.jpg'],
  [934, 'Du rififi chez les hommes', '1955-04-13', 7.8, 656, [80, 53, 18], null],
  [12153, 'F.B.I. Fausses Blondes Infiltrées', '2004-06-23', 7.0, 4742, [35, 80], '/PedA5zKb8Y3nZEHPGx9LwGlfPx.jpg']
].map(mk);

const CITY_NIGHT_RATED = [
  [4935, 'Le Château ambulant', '2004-09-09', 8.4, 11427, [14, 16, 12], '/45PVXJUYfH6yIINcQKelQ0SJPvh.jpg'],
  [103, 'Taxi Driver', '1976-02-09', 8.1, 13778, [80, 18], '/iyHQrfNsjZlfHJ8hyhNi0yAFnZa.jpg'],
  [548, 'Rashōmon', '1950-08-26', 8.0, 2602, [80, 18, 9648], '/zqc86MkNP2382tiXtBE1jn0XW7V.jpg'],
  [437068, 'A Taxi Driver', '2017-08-02', 8.0, 1220, [28, 18, 36], '/5n7sbyS3QTIIZ1epq7QiNxUwWpK.jpg'],
  [568160, 'Les Enfants du temps', '2019-07-19', 8.0, 2709, [16, 18, 14, 10749], '/aaA9BMG4fvq9KCLz3W4iVcAWRcU.jpg'],
  [627, 'Trainspotting', '1996-02-23', 8.0, 10651, [18, 80], '/wSjSdfnVjD6r8Fnn0K8FXz3JciM.jpg'],
  [31414, 'Le Tango de Satan', '1994-04-28', 8.0, 321, [18], '/hySy5g6xncM3U1iRsdPgYyahXM0.jpg'],
  [6075, 'L\'Impasse', '1993-11-10', 7.8, 3578, [80, 18, 53], '/cjki1jkGhrDhs9ir1dV7qsCqeXz.jpg'],
  [934, 'Du rififi chez les hommes', '1955-04-13', 7.8, 656, [80, 53, 18], null],
  [277216, 'N.W.A : Straight Outta Compton', '2015-08-11', 7.8, 4293, [18, 10402, 36], '/kyBVUPrCM2QSCZw6paGs0MLAufL.jpg'],
  [5991, 'Le Dernier des hommes', '1924-12-23', 7.8, 364, [18], '/wmUD851eeiRE0QMUUgYuko1wun1.jpg'],
  [779047, 'Nous, toujours', '2021-03-03', 7.8, 356, [16, 18, 10751, 10749], '/gnbbSTsltQZdq61tDVyqFAJXs6N.jpg']
].map(mk);

const ROBOT_POPULAR = [
  [218, 'Terminator', '1984-10-26', 7.7, 15102, [28, 53, 878], '/oShNrYScpLBi4pyOjytPy9BerRr.jpg'],
  [1184918, 'Le Robot sauvage', '2024-09-12', 8.3, 6583, [10751, 16, 878, 12], '/2IUCa73cvvIgZSiJcNtPBf4L5iF.jpg'],
  [603, 'Matrix', '1999-03-31', 8.3, 28707, [28, 878], '/pEoqbqtLc4CcwDUDqxmEDSWpWTZ.jpg'],
  [99861, 'Avengers : L\'Ère d\'Ultron', '2015-04-22', 7.3, 25011, [28, 12, 878], '/A0tw88n1byyR2vodhJMlFPQGQgF.jpg'],
  [11, 'La Guerre des étoiles', '1977-05-25', 8.2, 22854, [12, 28, 878], '/qelTNHrBSYjPvwdzsDBPVsqnNzc.jpg'],
  [280, 'Terminator 2 : Le Jugement dernier', '1991-07-03', 8.2, 14826, [28, 53, 878], '/mRtFOHF93zW4kTp4JOYrH71vxBh.jpg'],
  [335984, 'Blade Runner 2049', '2017-10-04', 7.6, 15657, [878, 18], '/qWD9E0Wgn8w6nMMutCNFAUiSHrX.jpg'],
  [177572, 'Les Nouveaux Héros', '2014-10-24', 7.7, 16909, [12, 10751, 16, 28, 35], '/wu361kPckigxzW19qtUbpCDzg0f.jpg'],
  [10681, 'WALL·E', '2008-06-26', 8.1, 20851, [16, 10751, 878], '/4ImYwxnu4bOitzS9TDLnantF8mn.jpg'],
  [348, 'Alien, le huitième passager', '1979-05-25', 8.2, 16832, [27, 878], '/l8CES84JndFlNfBNMxdLRYaLvI6.jpg'],
  [39254, 'Real Steel', '2011-09-28', 7.1, 9536, [28, 878, 18], '/ebV1lxTaLBS1Vk1ihHCVhhdg03X.jpg'],
  [1307118, 'Soulm8te', '2026-07-31', 7.4, 323, [27, 878, 53], '/bNErActDctl6cdUGw9pnjSCmyhQ.jpg']
].map(mk);

const ROBOT_RATED = [
  [1891, 'L\'Empire contre-attaque', '1980-05-20', 8.4, 18839, [12, 28, 878], '/qDvctAykmNWAmi9G2GrVrwWx3pr.jpg'],
  [1184918, 'Le Robot sauvage', '2024-09-12', 8.3, 6583, [10751, 16, 878, 12], '/2IUCa73cvvIgZSiJcNtPBf4L5iF.jpg'],
  [603, 'Matrix', '1999-03-31', 8.3, 28707, [28, 878], '/pEoqbqtLc4CcwDUDqxmEDSWpWTZ.jpg'],
  [11, 'La Guerre des étoiles', '1977-05-25', 8.2, 22854, [12, 28, 878], '/qelTNHrBSYjPvwdzsDBPVsqnNzc.jpg'],
  [348, 'Alien, le huitième passager', '1979-05-25', 8.2, 16832, [27, 878], '/l8CES84JndFlNfBNMxdLRYaLvI6.jpg'],
  [280, 'Terminator 2 : Le Jugement dernier', '1991-07-03', 8.2, 14826, [28, 53, 878], '/mRtFOHF93zW4kTp4JOYrH71vxBh.jpg'],
  [10681, 'WALL·E', '2008-06-26', 8.1, 20851, [16, 10751, 878], '/4ImYwxnu4bOitzS9TDLnantF8mn.jpg'],
  [19, 'Metropolis', '1927-01-10', 8.1, 3195, [18, 878], '/vHDWZOpupmKB7iNuiWFqnUSjfmN.jpg'],
  [679, 'Aliens, le retour', '1986-07-18', 8.0, 11171, [28, 53, 878], '/3eHFrdmBENZMbutlNMguqTAl3bf.jpg'],
  [10386, 'Le Géant de fer', '1999-08-06', 8.0, 6361, [16, 18, 10751, 878, 12], '/yNN7ViuLLEtobKpbVKhiKmu8FNg.jpg'],
  [838240, 'Mon ami robot', '2023-12-06', 8.0, 844, [16, 18, 35, 878], '/52a74RxIaYgdZxUoe0SxcUa2Vy7.jpg'],
  [755812, 'Miraculous World : New York', '2020-09-25', 8.1, 1135, [16, 10751, 28, 12], '/kIHgjAkuzvKBnmdstpBOo4AfZah.jpg']
].map(mk);

const RAIN_POPULAR = [
  [155, 'The Dark Knight : Le Chevalier noir', '2008-07-16', 8.5, 36686, [28, 53], '/pyNXnq8QBWoK3b37RS6C3axwUOy.jpg'],
  [414906, 'The Batman', '2022-03-01', 7.7, 12495, [80, 9648, 53], '/t9JGg10CW1DzXEdWL54ewkUko6N.jpg'],
  [680, 'Pulp Fiction', '1994-09-10', 8.5, 30854, [53, 80, 35], '/4TBdF7nFw2aKNM0gPOlDNq3v3se.jpg'],
  [807, 'Seven', '1995-09-22', 8.4, 23758, [80, 9648, 53], '/to6jUaLJonMuKW2YovtWfQKtLYP.jpg'],
  [11324, 'Shutter Island', '2010-02-14', 8.2, 26410, [18, 53, 9648], '/fQ0vGVTtxjCdAJnxwPZ88O3Wzrh.jpg'],
  [4935, 'Le Château ambulant', '2004-09-09', 8.4, 11427, [14, 16, 12], '/45PVXJUYfH6yIINcQKelQ0SJPvh.jpg'],
  [127585, 'X-Men : Days of Future Past', '2014-05-15', 7.5, 16644, [28, 12, 878], '/zGSi4NG7SfyILp3SOfBgVo4VoWG.jpg'],
  [603692, 'John Wick : Chapitre 4', '2023-03-21', 7.7, 8283, [28, 53, 80], '/n1YTIyhAqqqFyDGFTzV7WaU1JfK.jpg'],
  [101, 'Léon', '1994-09-14', 8.3, 16500, [80, 18, 28], '/efqJtlo5J1hBNFmbwyjyAR9Mpr2.jpg'],
  [546554, 'À couteaux tirés', '2019-11-27', 7.8, 14473, [35, 80, 9648], '/4kxVUW4hMurLs7ascwahF7blEUs.jpg'],
  [414419, 'Kill Bill : The Whole Bloody Affair', '2011-03-27', 8.1, 1418, [28, 80, 18, 53], '/nSOJfWJCdVFZQwXQA7RXn7FIIiY.jpg'],
  [105864, 'Le Voyage d\'Arlo', '2015-11-14', 6.8, 6147, [12, 16, 10751], '/vvYCGP9ePgSlNXy4lyJSBMClKbA.jpg']
].map(mk);

const RAIN_RATED = [
  [155, 'The Dark Knight : Le Chevalier noir', '2008-07-16', 8.5, 36686, [28, 53], '/pyNXnq8QBWoK3b37RS6C3axwUOy.jpg'],
  [680, 'Pulp Fiction', '1994-09-10', 8.5, 30854, [53, 80, 35], '/4TBdF7nFw2aKNM0gPOlDNq3v3se.jpg'],
  [4935, 'Le Château ambulant', '2004-09-09', 8.4, 11427, [14, 16, 12], '/45PVXJUYfH6yIINcQKelQ0SJPvh.jpg'],
  [807, 'Seven', '1995-09-22', 8.4, 23758, [80, 9648, 53], '/to6jUaLJonMuKW2YovtWfQKtLYP.jpg'],
  [274, 'Le Silence des agneaux', '1991-02-14', 8.3, 18491, [80, 53, 18], '/sSQDxwm4r28YpJSQVyVOtpYVs0E.jpg'],
  [101, 'Léon', '1994-09-14', 8.3, 16500, [80, 18, 28], '/efqJtlo5J1hBNFmbwyjyAR9Mpr2.jpg'],
  [670, 'Old Boy', '2003-11-21', 8.2, 10190, [53, 9648], '/u0Ct3708zXaoJCkF65bLfenQmhM.jpg'],
  [11324, 'Shutter Island', '2010-02-14', 8.2, 26410, [18, 53, 9648], '/fQ0vGVTtxjCdAJnxwPZ88O3Wzrh.jpg'],
  [77, 'Memento', '2000-10-11', 8.2, 16742, [9648, 53], '/nK3cJaUWx1iaQ9Cs08JPtZqVzQ6.jpg'],
  [629, 'Usual Suspects', '1995-07-19', 8.2, 11727, [18, 80, 53], '/h06jDZB4Y9YQJiSGTcUwbhuiUrB.jpg'],
  [29259, 'Le Trou', '1960-03-18', 8.2, 599, [18, 53, 80], '/pyCMEIAtMPpWTVwZTajcbCIBI3u.jpg'],
  [426, 'Sueurs froides', '1958-05-28', 8.1, 6495, [9648, 10749, 53], '/hkhbbSQdsV3U0HtuPugHfx2wOi9.jpg']
].map(mk);

const DEMO_POOLS = {
  city_night: { popular: CITY_NIGHT_POPULAR, rated: CITY_NIGHT_RATED },
  robot: { popular: ROBOT_POPULAR, rated: ROBOT_RATED },
  rain: { popular: RAIN_POPULAR, rated: RAIN_RATED }
};

const ALL_MOVIES = [...new Map(
  [...CITY_NIGHT_POPULAR, ...CITY_NIGHT_RATED, ...ROBOT_POPULAR, ...ROBOT_RATED, ...RAIN_POPULAR, ...RAIN_RATED]
    .map(m => [m.id, m])
).values()];

/** Tout sticker hors des trois viviers figés reçoit une rotation déterministe du catalogue. */
function fallbackPool(stickerId) {
  const offset = hashString(stickerId) % ALL_MOVIES.length;
  const rotated = [...ALL_MOVIES.slice(offset), ...ALL_MOVIES.slice(0, offset)];
  return { popular: rotated.slice(0, 12), rated: [...rotated].reverse().slice(0, 12) };
}

export function createDemoClient() {
  return {
    auth: 'demo',
    async validate() { return true; },
    async resolveKeyword() { return 1; },
    async resolveSticker() { return [1]; },
    async discover() { return { page: 1, results: [], total_pages: 1, total_results: 0 }; },
    async stickerPools(sticker) { return DEMO_POOLS[sticker.id] || fallbackPool(sticker.id); },
    async movieDetails(id) {
      return ALL_MOVIES.find(m => m.id === Number(id)) || { id: Number(id), title: 'Film inconnu', overview: OVERVIEW, genres: [] };
    },
    posterUrl,
    movieUrl
  };
}

export { DEMO_POOLS };
