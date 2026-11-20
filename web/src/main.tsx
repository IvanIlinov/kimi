import { render } from 'preact';
import { App } from './App';
import { initTelegram } from './lib/telegram';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/arena.css';

initTelegram();
render(<App />, document.getElementById('root')!);
