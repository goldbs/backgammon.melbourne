// Association-managed public listings. Add only events the association has approved.
// Both arrays appear in the shared selectable Google map/calendar.
window.MBA_EVENTS_CONFIG = {
  associationEvents: [],
  sisterClubTournaments: [
    {
      approved: true,
      title: 'Monday tournament',
      organiser: 'Victorian Backgammon Association',
      recurrence: { weekday: 1, startTime: '19:00' },
      shortSchedule: 'Mondays · 7pm',
      schedule: 'Every Monday · Register from 6:45pm · Starts 7pm sharp',
      venue: 'Umbrella Lounge Bar and Restaurant',
      address: '338–340 Glenhuntly Road, Elsternwick VIC',
      sourceUrl: 'https://www.vicbg.org.au/',
      format: 'Double elimination',
      description: '$20 entry includes a coffee or juice and contributes to club membership. Doubling cube in play; results count towards ANZBGF ratings. No late entry. Check the organiser’s listing for changes.'
    },
    {
      approved: true,
      title: 'Thursday backgammon',
      organiser: 'Melbourne Backgammon Club',
      recurrence: { weekday: 4, startTime: '19:00', endTime: '22:00', excludeDates: ['2026-12-24', '2026-12-31'] },
      shortSchedule: 'Thursdays · 7–10pm',
      schedule: 'Every Thursday · 7–10pm',
      venue: 'Hub 133',
      address: '133 Thomas Street, Brighton East VIC',
      sourceUrl: 'https://melbournebackgammonclub.com/',
      format: 'Weekly matches',
      description: '$10 entry, cash only. Optional extra $10 weekly prize pool. All experience levels welcome. Club closed 24–31 December 2026. Check the organiser’s listing for changes.'
    },
    {
      approved: true,
      title: 'Sunday backgammon',
      organiser: 'Melbourne North Backgammon Club',
      recurrence: { weekday: 0, weeksOfMonth: [2, 4], startTime: '13:30' },
      shortSchedule: 'Second and fourth Sundays · 1:30pm',
      schedule: 'Second and fourth Sundays · Arrive 1:15pm · Starts 1:30pm',
      venue: 'Moonee Valley Bowls Club',
      address: '2A Pattison Street, Moonee Ponds VIC',
      sourceUrl: 'https://anzbgf.org/backgammon-clubs-2/',
      format: 'Club tournament',
      description: 'Beginners welcome; free lessons and a tournament. Schedule listed by ANZBGF; entry fee not published. Confirm the session with the club via the federation listing before travelling.'
    }
  ]
};
