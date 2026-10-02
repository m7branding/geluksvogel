/** "6 augustus 2018" — dates on the site read the way a Dutch visitor says them. */
export const formatDate = (date: Date) =>
  date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' });
