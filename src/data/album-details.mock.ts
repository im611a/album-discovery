/**
 * 阶段 0.2D 专辑详情静态原型专用的完全虚构数据。
 * 下列发行公司、曲目名称、曲目艺术家与时长均为界面测试占位内容，
 * 不代表真实音乐作品，也不是从网易云音乐、RYM 或其他来源复制而来。
 */

import { albumsMock } from "@/data/albums.mock";

export type MockTrack = {
  id: string;
  title: string;
  trackNumber: number;
  discNumber: number;
  artists: string[];
  durationMs: number;
};

export type MockAlbumDetail = {
  albumId: string;
  company: string | null;
  tracks: MockTrack[];
};

type TrackSeed = {
  title: string;
  durationMs: number;
  discNumber?: number;
  artists?: string[];
};

const albumArtistsById = new Map(
  albumsMock.map((album) => [album.id, album.artists] as const),
);

function createDetail(
  albumId: string,
  company: string | null,
  seeds: TrackSeed[],
): MockAlbumDetail {
  const albumArtists = albumArtistsById.get(albumId);

  if (!albumArtists) {
    throw new Error(`Unknown mock album: ${albumId}`);
  }

  const nextTrackNumberByDisc = new Map<number, number>();
  const tracks = seeds.map((seed) => {
    const discNumber = seed.discNumber ?? 1;
    const trackNumber = (nextTrackNumberByDisc.get(discNumber) ?? 0) + 1;
    nextTrackNumberByDisc.set(discNumber, trackNumber);

    return {
      id: `${albumId}-d${discNumber}-t${trackNumber}`,
      title: seed.title,
      trackNumber,
      discNumber,
      artists: seed.artists ?? albumArtists,
      durationMs: seed.durationMs,
    };
  });

  return { albumId, company, tracks };
}

export const albumDetailsMock: MockAlbumDetail[] = [
  createDetail("mock-001", "微光唱片（虚构）", [
    { title: "折叠的夜色", durationMs: 226_000 },
    { title: "纸面潮汐", durationMs: 251_000 },
    { title: "缓慢经过屋顶", durationMs: 284_000 },
    { title: "月光练习", durationMs: 198_000 },
    { title: "清晨留白", durationMs: 263_000 },
  ]),
  createDetail("mock-002", "North Window Records（虚构）", [
    { title: "Cloud Index", durationMs: 212_000 },
    { title: "Before the Streetlights", durationMs: 239_000 },
    { title: "Small Weather", durationMs: 187_000 },
    { title: "Rooms in Blue", durationMs: 268_000 },
    { title: "After the Rainline", durationMs: 224_000 },
  ]),
  createDetail("mock-003", null, [
    { title: "旧地址", durationMs: 205_000 },
    { title: "未寄出的明信片", durationMs: 232_000 },
    { title: "南向窗口", durationMs: 258_000 },
    { title: "雨季投递", durationMs: 219_000 },
    { title: "最后一班邮车", durationMs: 276_000 },
  ]),
  createDetail("mock-004", "Silver Block Audio（虚构）", [
    { title: "Reflected Avenue", durationMs: 194_000 },
    { title: "Two-Way Glass", durationMs: 231_000 },
    { title: "Signal in the Lobby", durationMs: 216_000 },
    {
      title: "Borrowed Skyline",
      durationMs: 247_000,
      artists: ["Mira Vale", "Northbound"],
    },
    { title: "Exit Through Morning", durationMs: 209_000 },
  ]),
  createDetail("mock-005", "潮间制作室（虚构）", [
    { title: "透明水位", durationMs: 301_000 },
    { title: "折射面", durationMs: 245_000 },
    { title: "低潮之后", durationMs: 278_000 },
    { title: "无声航标", durationMs: 233_000 },
    { title: "玻璃海岸线", durationMs: 319_000 },
  ]),
  createDetail("mock-006", "Quiet Terminal（虚构）", [
    { title: "Last Stop Open", durationMs: 263_000 },
    { title: "Window Seat Static", durationMs: 288_000 },
    { title: "No Timetable", durationMs: 241_000 },
    { title: "Passing Empty Towns", durationMs: 315_000 },
    { title: "Depot at Dawn", durationMs: 272_000 },
  ]),
  createDetail("mock-007", "银尘声画（虚构）", [
    { title: "开场灯", durationMs: 118_000 },
    { title: "空座位", durationMs: 206_000 },
    { title: "慢速追光", durationMs: 254_000 },
    { title: "片尾之前", durationMs: 231_000 },
    { title: "散场星屑", durationMs: 176_000 },
  ]),
  createDetail("mock-008", "迁徙电波（虚构）", [
    { title: "北纬广播", durationMs: 201_000 },
    { title: "沿风公路", durationMs: 226_000 },
    { title: "短暂停靠", durationMs: 194_000 },
    { title: "越过云层", durationMs: 248_000 },
    { title: "下一季信号", durationMs: 217_000 },
  ]),
  createDetail("mock-009", "空房间档案（虚构）", [
    { title: "站台时钟", durationMs: 342_000, discNumber: 1 },
    { title: "没有到来的列车", durationMs: 468_000, discNumber: 1 },
    { title: "凌晨四点零七分", durationMs: 395_000, discNumber: 1 },
    { title: "穿过无人隧道", durationMs: 426_000, discNumber: 2 },
    { title: "地图边缘", durationMs: 377_000, discNumber: 2 },
    { title: "天亮以后继续走", durationMs: 512_000, discNumber: 2 },
  ]),
  createDetail("mock-010", "Roaming Desk Tapes（虚构）", [
    { title: "Temporary Key", durationMs: 183_000 },
    { title: "Forwarding Address", durationMs: 224_000 },
    { title: "Suitcase Radio", durationMs: 207_000 },
    { title: "Corner Store Notes", durationMs: 198_000 },
    { title: "Anywhere for Tonight", durationMs: 236_000 },
  ]),
  createDetail("mock-011", "沿岸唱片室（虚构）", [
    { title: "堤岸来信", durationMs: 242_000 },
    { title: "蓝色步道", durationMs: 216_000 },
    { title: "风经过防波堤", durationMs: 279_000 },
    { title: "傍晚潮声", durationMs: 253_000 },
    { title: "灯塔以南", durationMs: 268_000 },
  ]),
  createDetail("mock-012", "Soft Geometry Lab（虚构）", [
    { title: "Twin Petals", durationMs: 196_000 },
    { title: "Pixel Garden", durationMs: 214_000 },
    { title: "Folded Spectrum", durationMs: 189_000 },
    { title: "Side by Side", durationMs: 221_000 },
    { title: "Bloom Again", durationMs: 203_000 },
  ]),
  createDetail("mock-013", "微环境记录（虚构）", [
    { title: "室内降雨", durationMs: 332_000 },
    { title: "玻璃上的气压", durationMs: 287_000 },
    { title: "苔藓测量", durationMs: 361_000 },
    { title: "局部雾", durationMs: 309_000 },
    { title: "晴间多云", durationMs: 344_000 },
  ]),
  createDetail("mock-014", "Meadow Room Records（虚构）", [
    { title: "Open Hands", durationMs: 218_000 },
    { title: "Kitchen Light", durationMs: 201_000 },
    { title: "A Chair by the Door", durationMs: 244_000 },
    { title: "Quiet Arrival", durationMs: 229_000 },
    { title: "Where the Floor Is Warm", durationMs: 256_000 },
  ]),
  createDetail("mock-015", "山径声音社（虚构）", [
    { title: "石阶", durationMs: 238_000 },
    { title: "越过松林", durationMs: 274_000 },
    { title: "远处炊烟", durationMs: 226_000 },
    { title: "回声采集", durationMs: 301_000 },
    { title: "下山之前", durationMs: 259_000 },
  ]),
  createDetail("mock-016", "Orchard Signal（虚构）", [
    { title: "Electric Fruit", durationMs: 205_000 },
    { title: "Summer Circuit", durationMs: 233_000 },
    { title: "Green Neon", durationMs: 218_000 },
    { title: "Branches at Midnight", durationMs: 247_000 },
    { title: "Harvest the Light", durationMs: 226_000 },
  ]),
  createDetail("mock-017", "第九幕音乐（虚构）", [
    { title: "黑幕升起", durationMs: 132_000 },
    { title: "走廊脚步", durationMs: 198_000 },
    { title: "未冲洗的底片", durationMs: 243_000 },
    { title: "第九场", durationMs: 217_000 },
    { title: "熄灯", durationMs: 151_000 },
  ]),
  createDetail("mock-018", "Tide Assembly（虚构）", [
    { title: "Shoreline One", durationMs: 292_000 },
    { title: "Between Two Harbors", durationMs: 338_000 },
    { title: "潮汐合唱", durationMs: 306_000, artists: ["周以宁", "Aster Choir"] },
    {
      title: "A Map Made of Water",
      durationMs: 355_000,
      artists: ["Harbor Sleep", "周以宁", "Aster Choir"],
    },
    { title: "Same Sea, Different Morning", durationMs: 327_000 },
  ]),
];
