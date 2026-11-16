"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md p-10">
      <h1 className="text-lg font-semibold">That didn’t work</h1>
      <p className="mt-2 text-sm text-muted">{error.message}</p>
      <button onClick={reset} className="mt-4 rounded-md bg-ink px-3 py-2 text-sm text-white">Try again</button>
    </div>
  );
}
