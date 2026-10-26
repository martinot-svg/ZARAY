import Image from 'next/image';

type BrandLogoProps = { priority?: boolean; className?: string };

/** Two transparent rasterizations of the user-supplied wordmark, selected by the active theme. */
export default function BrandLogo({ priority = false, className = '' }: BrandLogoProps) {
  return <span role="img" aria-label="ZARAY" className={['brand-logo',className].filter(Boolean).join(' ')}>
    <Image src="/brand/zaray-light.png" width={512} height={150} alt=""
      aria-hidden="true" priority={priority} unoptimized className="brand-logo-variant brand-logo-on-light" />
    <Image src="/brand/zaray-dark.png" width={512} height={150} alt=""
      aria-hidden="true" priority={priority} unoptimized className="brand-logo-variant brand-logo-on-dark" />
  </span>;
}
