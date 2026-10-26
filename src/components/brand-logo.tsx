import Image from 'next/image';

type BrandLogoProps = {
  priority?: boolean;
  className?: string;
};

/**
 * Original ZARAY PNG files. The images are displayed unchanged:
 * no rasterization, recoloring, background removal or CSS filters.
 * The visible variant is chosen by the real surface/theme in CSS.
 */
export default function BrandLogo({ priority = false, className = '' }: BrandLogoProps) {
  return <span role="img" aria-label="ZARAY" className={['brand-logo', className].filter(Boolean).join(' ')}>
    <Image
      src="/brand/zaray-noir-vert-original.png"
      width={2048}
      height={746}
      alt=""
      aria-hidden="true"
      unoptimized
      priority={priority}
      className="brand-logo-variant brand-logo-light"
    />
    <Image
      src="/brand/zaray-blanc-vert-original.png"
      width={2048}
      height={682}
      alt=""
      aria-hidden="true"
      unoptimized
      priority={priority}
      className="brand-logo-variant brand-logo-dark"
    />
  </span>;
}
