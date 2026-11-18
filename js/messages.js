// Little words of encouragement, all written for Bunny Meadow.

export function greeting(date = new Date(), name = '') {
  const h = date.getHours();
  const who = name ? `, ${name}` : ', little bunny';
  if (h < 5) return `Still awake${who}? Be gentle with yourself.`;
  if (h < 12) return `Good morning${who}!`;
  if (h < 17) return `Good afternoon${who}!`;
  if (h < 21) return `Good evening${who}!`;
  return `Cosy night studies${who}?`;
}

export const DAILY = [
  'Small steps still cross the whole meadow.',
  'Ready to grow your knowledge today?',
  'One pomodoro at a time – that is how gardens grow.',
  'You do not have to finish everything. Just begin.',
  'Slow and steady. The bunny gets there too.',
  'Every quiet minute of focus is a seed planted.',
  'Today’s effort is tomorrow’s easy.',
  'Be curious, be kind to yourself, keep going.',
  'A tidy mind is a sunny meadow.',
  'Twenty-five minutes. You can do anything for twenty-five minutes.',
  'Progress, not perfection.',
  'Little by little, the flowers bloom.',
  'Rest is part of the work – take your breaks.',
  'You showed up. That is the hardest part.',
  'Learn something today that makes you smile.',
  'The meadow is calm. So is your focus.',
];

export const FOCUS_DONE = [
  'Lovely work! A flower just bloomed for you.',
  'Pomodoro complete – time to stretch your paws.',
  'Well done! Your brain earned a little rest.',
  'Another seed planted. Take a breath.',
  'Beautifully focused. Enjoy your break.',
  'That was a good one. Sip some water!',
];

export const BREAK_DONE = [
  'Break’s over – ready when you are.',
  'Feeling refreshed? Back to the meadow.',
  'Let’s hop back into it.',
];

export const NO_TASKS = [
  'No tasks yet – the meadow is wonderfully quiet.',
  'Nothing planned. A perfect moment to add one small thing.',
  'All clear! Even bunnies need a blank page sometimes.',
];

export const ALL_DONE = 'Everything is done! Go and enjoy the sunshine.';

export const GOAL_REACHED = [
  'Daily goal reached! The meadow is in full bloom.',
  'You did it – today’s goal is complete!',
];
