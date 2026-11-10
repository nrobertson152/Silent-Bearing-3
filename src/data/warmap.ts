// Who held what, and when: a coarse political map of the war for the campaign
// screen. Keys are ISO 3166-1 numeric codes as used by the world-atlas data.
// Each entry is a list of [from date, alignment]; the last entry not after the
// date in question applies. Countries not listed are neutral throughout.

export type Alignment = 'allies' | 'axis' | 'occupied' | 'neutral';

type Timeline = [string, Alignment][];

const ALLIES: Timeline = [['1939-09-01', 'allies']];
const AXIS: Timeline = [['1939-09-01', 'axis']];

/** The Soviet Union and its republics: neutral until Barbarossa. */
const SOVIET: Timeline = [['1939-09-01', 'neutral'], ['1941-06-22', 'allies']];
/** Overrun in 1941, liberated in 1944. */
const SOVIET_WEST: Timeline = [['1939-09-01', 'neutral'], ['1941-06-22', 'allies'], ['1941-09-01', 'occupied'], ['1944-08-01', 'allies']];
const BALTIC: Timeline = [['1939-09-01', 'neutral'], ['1941-07-15', 'occupied'], ['1944-10-01', 'allies']];
const YUGOSLAVIA: Timeline = [['1939-09-01', 'neutral'], ['1941-04-17', 'occupied'], ['1944-10-20', 'allies']];
/** British Empire and Commonwealth territories. */
const EMPIRE: Timeline = ALLIES;

const T: Record<string, Timeline> = {
  // ------------------------------------------------------------ Europe
  '826': ALLIES, // United Kingdom
  '372': [['1939-09-01', 'neutral']], // Ireland
  '352': [['1939-09-01', 'neutral'], ['1940-05-10', 'allies']], // Iceland
  '304': [['1939-09-01', 'neutral'], ['1941-04-09', 'allies']], // Greenland
  '250': [['1939-09-01', 'allies'], ['1940-06-22', 'occupied'], ['1944-08-25', 'allies']], // France
  '276': AXIS, // Germany
  '040': AXIS, // Austria
  '203': [['1939-09-01', 'occupied']], // Czechia
  '703': AXIS, // Slovakia
  '616': [['1939-09-01', 'allies'], ['1939-10-06', 'occupied']], // Poland
  '208': [['1939-09-01', 'neutral'], ['1940-04-09', 'occupied']], // Denmark
  '578': [['1939-09-01', 'neutral'], ['1940-04-09', 'allies'], ['1940-06-10', 'occupied']], // Norway
  '528': [['1939-09-01', 'neutral'], ['1940-05-15', 'occupied']], // Netherlands
  '056': [['1939-09-01', 'neutral'], ['1940-05-28', 'occupied'], ['1944-09-04', 'allies']], // Belgium
  '442': [['1939-09-01', 'neutral'], ['1940-05-10', 'occupied'], ['1944-09-10', 'allies']], // Luxembourg
  '380': [['1939-09-01', 'neutral'], ['1940-06-10', 'axis'], ['1943-09-08', 'occupied']], // Italy
  '008': [['1939-09-01', 'occupied']], // Albania (Italian since April 1939)
  '300': [['1939-09-01', 'neutral'], ['1940-10-28', 'allies'], ['1941-05-31', 'occupied'], ['1944-10-12', 'allies']], // Greece
  '191': YUGOSLAVIA, '070': YUGOSLAVIA, '705': YUGOSLAVIA, '499': YUGOSLAVIA, '807': YUGOSLAVIA, '688': YUGOSLAVIA,
  '348': [['1939-09-01', 'neutral'], ['1940-11-20', 'axis']], // Hungary
  '642': [['1939-09-01', 'neutral'], ['1940-11-23', 'axis'], ['1944-08-23', 'allies']], // Romania
  '100': [['1939-09-01', 'neutral'], ['1941-03-01', 'axis'], ['1944-09-09', 'allies']], // Bulgaria
  '246': [['1939-09-01', 'neutral'], ['1941-06-25', 'axis'], ['1944-09-19', 'neutral']], // Finland
  '752': [['1939-09-01', 'neutral']], // Sweden
  '756': [['1939-09-01', 'neutral']], // Switzerland
  '724': [['1939-09-01', 'neutral']], // Spain
  '620': [['1939-09-01', 'neutral']], // Portugal
  '792': [['1939-09-01', 'neutral'], ['1945-02-23', 'allies']], // Turkey
  '643': SOVIET, // Russia
  '804': SOVIET_WEST, // Ukraine
  '112': SOVIET_WEST, // Belarus
  '498': SOVIET_WEST, // Moldova
  '233': BALTIC, '428': BALTIC, '440': BALTIC,
  '268': SOVIET, '051': SOVIET, '031': SOVIET, '398': SOVIET, '860': SOVIET, '795': SOVIET, '762': SOVIET, '417': SOVIET,
  '196': EMPIRE, // Cyprus

  // ------------------------------------------------------------ Africa and the Middle East
  '818': EMPIRE, // Egypt
  '434': [['1939-09-01', 'neutral'], ['1940-06-10', 'axis'], ['1943-01-23', 'allies']], // Libya
  '788': [['1939-09-01', 'allies'], ['1940-06-22', 'neutral'], ['1942-11-09', 'occupied'], ['1943-05-13', 'allies']], // Tunisia
  '012': [['1939-09-01', 'allies'], ['1940-06-22', 'neutral'], ['1942-11-08', 'allies']], // Algeria
  '504': [['1939-09-01', 'allies'], ['1940-06-22', 'neutral'], ['1942-11-08', 'allies']], // Morocco
  '231': [['1939-09-01', 'occupied'], ['1941-05-05', 'allies']], // Ethiopia
  '232': [['1939-09-01', 'neutral'], ['1940-06-10', 'axis'], ['1941-04-01', 'allies']], // Eritrea
  '706': [['1939-09-01', 'neutral'], ['1940-06-10', 'axis'], ['1941-02-25', 'allies']], // Somalia
  '729': EMPIRE, '728': EMPIRE, '404': EMPIRE, '834': EMPIRE, '800': EMPIRE, '566': EMPIRE, '288': EMPIRE, '694': EMPIRE,
  '710': EMPIRE, '716': EMPIRE, '894': EMPIRE, '454': EMPIRE, '072': EMPIRE, '426': EMPIRE, '748': EMPIRE, '270': EMPIRE,
  '516': EMPIRE,
  '376': EMPIRE, '275': EMPIRE, '400': EMPIRE, // Palestine and Transjordan
  '368': [['1939-09-01', 'allies'], ['1941-04-01', 'axis'], ['1941-05-31', 'allies']], // Iraq
  '364': [['1939-09-01', 'neutral'], ['1941-08-25', 'allies']], // Iran
  '760': [['1939-09-01', 'allies'], ['1940-06-22', 'neutral'], ['1941-07-14', 'allies']], // Syria
  '422': [['1939-09-01', 'allies'], ['1940-06-22', 'neutral'], ['1941-07-14', 'allies']], // Lebanon

  // ------------------------------------------------------------ Asia and the Pacific
  '392': AXIS, // Japan
  '408': AXIS, '410': AXIS, '158': AXIS, // Korea and Formosa
  '156': ALLIES, // China
  '356': EMPIRE, '586': EMPIRE, '050': EMPIRE, '144': EMPIRE, // India and Ceylon
  '104': [['1939-09-01', 'allies'], ['1942-05-20', 'occupied'], ['1945-05-03', 'allies']], // Burma
  '458': [['1939-09-01', 'allies'], ['1942-01-31', 'occupied']], // Malaya
  '096': [['1939-09-01', 'allies'], ['1942-01-01', 'occupied']], // Brunei
  '764': [['1939-09-01', 'neutral'], ['1941-12-21', 'axis']], // Thailand
  '704': [['1939-09-01', 'neutral'], ['1941-07-28', 'occupied']], // French Indochina
  '418': [['1939-09-01', 'neutral'], ['1941-07-28', 'occupied']],
  '116': [['1939-09-01', 'neutral'], ['1941-07-28', 'occupied']],
  '608': [['1939-09-01', 'allies'], ['1942-05-06', 'occupied'], ['1945-03-03', 'allies']], // Philippines
  '360': [['1939-09-01', 'allies'], ['1942-03-09', 'occupied']], // Dutch East Indies
  '626': [['1939-09-01', 'neutral'], ['1942-02-20', 'occupied']], // Timor
  '598': ALLIES, // Papua and New Guinea (Australian; the north coast was fought over)
  '090': [['1939-09-01', 'allies'], ['1942-05-03', 'occupied'], ['1943-02-09', 'allies']], // Solomon Islands
  '036': ALLIES, '554': ALLIES, '540': ALLIES, '548': ALLIES, '242': ALLIES, // Australia, New Zealand, New Caledonia, Vanuatu, Fiji

  // ------------------------------------------------------------ the Americas
  '124': ALLIES, // Canada
  '840': [['1939-09-01', 'neutral'], ['1941-12-08', 'allies']], // United States
  '630': [['1939-09-01', 'neutral'], ['1941-12-08', 'allies']], // Puerto Rico
  '484': [['1939-09-01', 'neutral'], ['1942-05-22', 'allies']], // Mexico
  '076': [['1939-09-01', 'neutral'], ['1942-08-22', 'allies']], // Brazil
  '192': [['1939-09-01', 'neutral'], ['1941-12-09', 'allies']], // Cuba
  '238': EMPIRE, '044': EMPIRE, '388': EMPIRE, '780': EMPIRE, '084': EMPIRE, '328': EMPIRE, // Falklands and the British Caribbean
};

export function alignmentOn(id: string | number | undefined, date: string): Alignment {
  if (id === undefined) return 'neutral';
  const t = T[String(id).padStart(3, '0')];
  if (!t) return 'neutral';
  let a: Alignment = 'neutral';
  for (const [d, v] of t) if (d <= date) a = v;
  return a;
}

/** Extent of each campaign's theatre: [west, south, east, north] in degrees. */
export const THEATRES: Record<'atlantic' | 'northsea' | 'pacific', { bounds: [number, number, number, number]; rotate: number }> = {
  atlantic: { bounds: [-68, -42, 38, 76], rotate: 15 },
  northsea: { bounds: [-52, 40, 42, 78], rotate: 0 },
  pacific: { bounds: [72, -28, 196, 44], rotate: -140 },
};
