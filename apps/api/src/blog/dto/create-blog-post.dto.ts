import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** GENERAL covers cross-country/product posts that aren't tied to one
 *  country's compliance rules. */
export const BLOG_COUNTRY_FOCUS = ['KE', 'NG', 'ZA', 'GENERAL'] as const;
export type BlogCountryFocus = (typeof BLOG_COUNTRY_FOCUS)[number];

export class CreateBlogPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  // Lowercase-hyphenated, matching the public /blog/[slug] route segment —
  // validated here rather than auto-derived server-side so the dashboard
  // can show (and let an editor fix) the real URL before it's created.
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers, and hyphens only',
  })
  @MaxLength(200)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  excerpt!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescription?: string;

  @IsIn(BLOG_COUNTRY_FOCUS)
  countryFocus!: BlogCountryFocus;
}
