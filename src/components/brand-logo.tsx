import Image from 'next/image';

type BrandLogoProps = {
  priority?: boolean;
  className?: string;
  surface?: 'light' | 'dark';
};

/** Shared transparent ZARAY wordmark; its original 785:247 aspect ratio is preserved. */
export default function BrandLogo({ priority = false, className = '', surface = 'dark' }: BrandLogoProps) {
  return <Image
    src={surface === 'light' ? '/brand/zaray-logo-on-light.svg' : '/brand/zaray-logo.svg'}
    alt="ZARAY"
    width={785}
    height={247}
    priority={priority}
    unoptimized
    className={['brand-logo', className].filter(Boolean).join(' ')}
  />;
}
