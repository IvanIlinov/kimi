import { render } from 'preact';
import { App } from './App';
import { initTelegram } from './lib/telegram';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/arena.css';

initTelegram();
const staging = import.meta.env.VITE_API_URL?.replace(/\/$/, '') === 'https://staging-82-148-234-108.sslip.io';
const root = document.getElementById('root')!;
if (staging) {
    document.body.dataset.studentLayout = 'hq-game';
    void import('../scripts/student-tablet-home').then(({ StudentTabletHome }) => {
        render(<App StudentHome={(props) => <StudentTabletHome {...props} staging />} />, root);
    });
} else {
    render(<App />, root);
}
