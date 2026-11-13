// Credit for the app icon (favicon, home-screen icon): Flaticon's free licence asks for a visible
// attribution. Shown at the bottom of the public sign-in screens.

const ICON_PAGE = 'https://www.flaticon.com/free-icon/classroom_906175';
const ICON_AUTHOR = 'Magnific';

export function IconCredit() {
  return (
    <p className="text-center text-xs text-slate-400">
      App icon:{' '}
      <a href={ICON_PAGE} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
        classroom icon by {ICON_AUTHOR}, Flaticon
      </a>
    </p>
  );
}
