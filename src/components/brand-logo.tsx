import Image from 'next/image';

/** Wordmark faithfully traced from the supplied transparent ZARAY artwork. */
export default function BrandLogo({ priority = false }: { priority?: boolean }) {
  return <Image src="/brand/zaray-logo.svg" alt="ZARAY" width={785} height={247}
    priority={priority} className="brand-logo" unoptimized />;
}
