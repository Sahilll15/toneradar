import type { Recipient } from '../lib/tone';

export type Sample = { id: string; label: string; channel: string; recipient: Recipient; draft: string; alt?: string };

export const SAMPLES: Sample[] = [
  {
    id: 'deadline',
    label: 'Slack to a teammate',
    channel: 'Slack',
    recipient: 'teammate',
    draft: `Hey, just circling back on this again.

As I mentioned in my last three messages, the API docs were due on Friday. I'm not sure what happened, but I guess it wasn't a priority?

Totally fine if you're busy. I'll just do it myself like always. Can you at least let me know by EOD if you're still on it?`,
    alt: `Hey, quick check on the API docs that were due Friday.

I know things have been hectic this week. Are you still able to take them, or should we split the work?

If you can send me a status by end of day, I'll plan around it. Thanks!`,
  },
  {
    id: 'delay',
    label: 'Email to a client',
    channel: 'Email',
    recipient: 'client',
    draft: `Hi Dana,

Sorry to bother you, I just wanted to maybe give you a quick update on the launch. I might be wrong, but it's possible we could slip a little past the 14th.

To be fair, the delay is mostly because the copy we got from your team came in late, so there wasn't much we could do on our side.

Let us know what you think.`,
    alt: `Hi Dana,

A quick update on the launch. We are now targeting the 21st instead of the 14th, one week later than planned.

The extra week lets us test the checkout flow properly with the final copy. Everything else is on track.

Could you confirm by Thursday that the 21st works for your team? Happy to jump on a call if that is easier.`,
  },
  {
    id: 'plans',
    label: 'Text to a friend',
    channel: 'Text',
    recipient: 'friend',
    draft: `Can't make Saturday. Work stuff came up. We should reschedule at some point I guess.`,
  },
];
