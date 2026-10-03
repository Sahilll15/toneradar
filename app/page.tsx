import { SiteFooter } from './components/SiteFooter';
import { ToneGuide } from './components/ToneGuide';
import { ToneRadar } from './components/ToneRadar';

export default function Page() {
  return (
    <ToneRadar>
      <ToneGuide />
      <SiteFooter />
    </ToneRadar>
  );
}
