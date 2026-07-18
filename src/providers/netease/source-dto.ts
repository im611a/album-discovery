import type {
  SourceField,
  NeteaseMarketChannel,
  UtcIsoTimestamp,
} from "@/domain/sources";

export interface NeteaseArtistSourceDto {
  readonly externalArtistId: SourceField<string>;
  readonly name: SourceField<string>;
}

export interface NeteaseTrackSourceDto {
  readonly externalTrackId: SourceField<string>;
  readonly title: SourceField<string>;
  readonly trackNumber: SourceField<number>;
  readonly discNumber: SourceField<number>;
  readonly artists: SourceField<readonly NeteaseArtistSourceDto[]>;
  readonly durationMs: SourceField<number>;
  readonly sourcePosition: number;
}

export interface NeteaseAlbumSourceDto {
  readonly externalAlbumId: SourceField<string>;
  readonly title: SourceField<string>;
  readonly aliases: SourceField<readonly string[]>;
  readonly artists: SourceField<readonly NeteaseArtistSourceDto[]>;
  readonly releaseTimestampMs: SourceField<number>;
  readonly rawAlbumType: SourceField<string>;
  readonly rawSubType: SourceField<string>;
  readonly company: SourceField<string>;
  readonly coverUrl: SourceField<string>;
  readonly reportedTrackCount: SourceField<number>;
  readonly tracks: SourceField<readonly NeteaseTrackSourceDto[]>;
}

export interface NeteaseNewReleaseRecordDto {
  readonly requestedMarketChannel: NeteaseMarketChannel;
  readonly sourceListEndpoint: string;
  readonly sourcePosition: number;
  readonly album: NeteaseAlbumSourceDto;
  readonly fetchedAt: UtcIsoTimestamp;
}

export interface NeteaseParserValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly reason: string;
}

export interface NeteaseParserResult<T> {
  readonly data: T | null;
  readonly issues: readonly NeteaseParserValidationIssue[];
  readonly parserVersion: string;
}

export const NETEASE_SOURCE_PARSER_VERSION = "0.3A.1";
