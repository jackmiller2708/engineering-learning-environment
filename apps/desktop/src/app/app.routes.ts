import { Routes } from '@angular/router';
import { pageTitle } from './page-title';
import { LaunchResolver } from './workspaces/launch-resolver';
import { LabFrame } from './workspaces/lab-frame';
import { WorldsScreen } from './workspaces/worlds-screen';

export const routes: Routes = [
  { path: '', component: LaunchResolver, pathMatch: 'full', title: pageTitle() },
  { path: 'worlds', component: WorldsScreen, title: pageTitle('Worlds') },
  // The workspace id in the address is the stable identity; it is validated and resolved by the component.
  // The generic title here keeps a previous screen's title from lingering. LabFrame then sets the lab's own.
  { path: 'workspace/:id', component: LabFrame, title: pageTitle() },
  { path: '**', redirectTo: 'worlds' },
];
