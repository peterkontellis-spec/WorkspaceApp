import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="empty-page">
      <span className="eyebrow">PAGE NOT FOUND</span>
      <h1>Let’s get you back.</h1>
      <p>This page isn’t part of the current workspace.</p>
      <Link className="button button--primary" href="/home">
        Back to Home
      </Link>
    </div>
  );
}
