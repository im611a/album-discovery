import Link from "next/link";

type SectionHeadingProps = {
  title: string;
  description: string;
  headingId: string;
  href?: string;
  linkLabel?: string;
};

export function SectionHeading({
  title,
  description,
  headingId,
  href,
  linkLabel,
}: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <div>
        <h2 id={headingId}>{title}</h2>
        <p>{description}</p>
      </div>
      {href && linkLabel ? (
        <Link className="text-link" href={href}>
          {linkLabel}
          <span aria-hidden="true"> →</span>
        </Link>
      ) : null}
    </div>
  );
}
