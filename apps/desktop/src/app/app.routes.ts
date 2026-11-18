import { Routes } from '@angular/router';
import { pageTitle } from './page-title';
import { LaunchResolver } from './workspaces/launch-resolver';
import { LabFrame } from './workspaces/lab-frame';
import { SignalRelayExperiment } from './experiments/signal-relay/signal-relay-experiment';
import { WorldsScreen } from './workspaces/worlds-screen';

export const routes: Routes = [
  { path: '', component: LaunchResolver, pathMatch: 'full', title: pageTitle() },
  { path: 'worlds', component: WorldsScreen, title: pageTitle('Worlds') },
  // The workspace id in the address is the stable identity; it is validated and resolved by the component.
  // The generic title here keeps a previous screen's title from lingering. LabFrame then sets the lab's own.
  { path: 'workspace/:id', component: LabFrame, title: pageTitle() },
  // An isolated, disposable experiment. Reachable by address only; deliberately not in any navigation.
  { path: 'experiments/signal-relay', component: SignalRelayExperiment, title: pageTitle('Signal relay experiment') },
  { path: '**', redirectTo: 'worlds' },
];
