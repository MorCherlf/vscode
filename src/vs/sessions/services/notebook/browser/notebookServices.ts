/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { INotebookService } from '../../../../workbench/contrib/notebook/common/notebookService.js';
import { NotebookService } from '../../../../workbench/contrib/notebook/browser/services/notebookServiceImpl.js';
import { INotebookEditorWorkerService } from '../../../../workbench/contrib/notebook/common/services/notebookWorkerService.js';
import { NotebookEditorWorkerServiceImpl } from '../../../../workbench/contrib/notebook/browser/services/notebookWorkerServiceImpl.js';
import { INotebookEditorModelResolverService } from '../../../../workbench/contrib/notebook/common/notebookEditorModelResolverService.js';
import { NotebookModelResolverServiceImpl } from '../../../../workbench/contrib/notebook/common/notebookEditorModelResolverServiceImpl.js';
import { INotebookCellStatusBarService } from '../../../../workbench/contrib/notebook/common/notebookCellStatusBarService.js';
import { NotebookCellStatusBarService } from '../../../../workbench/contrib/notebook/browser/services/notebookCellStatusBarServiceImpl.js';
import { INotebookEditorService } from '../../../../workbench/contrib/notebook/browser/services/notebookEditorService.js';
import { NotebookEditorWidgetService } from '../../../../workbench/contrib/notebook/browser/services/notebookEditorServiceImpl.js';
import { INotebookKernelService, INotebookKernelHistoryService } from '../../../../workbench/contrib/notebook/common/notebookKernelService.js';
import { NotebookKernelService } from '../../../../workbench/contrib/notebook/browser/services/notebookKernelServiceImpl.js';
import { NotebookKernelHistoryService } from '../../../../workbench/contrib/notebook/browser/services/notebookKernelHistoryServiceImpl.js';
import { INotebookExecutionService } from '../../../../workbench/contrib/notebook/common/notebookExecutionService.js';
import { NotebookExecutionService } from '../../../../workbench/contrib/notebook/browser/services/notebookExecutionServiceImpl.js';
import { INotebookExecutionStateService } from '../../../../workbench/contrib/notebook/common/notebookExecutionStateService.js';
import { NotebookExecutionStateService } from '../../../../workbench/contrib/notebook/browser/services/notebookExecutionStateServiceImpl.js';
import { INotebookRendererMessagingService } from '../../../../workbench/contrib/notebook/common/notebookRendererMessagingService.js';
import { NotebookRendererMessagingService } from '../../../../workbench/contrib/notebook/browser/services/notebookRendererMessagingServiceImpl.js';
import { INotebookKeymapService } from '../../../../workbench/contrib/notebook/common/notebookKeymapService.js';
import { NotebookKeymapService } from '../../../../workbench/contrib/notebook/browser/services/notebookKeymapServiceImpl.js';
import { INotebookLoggingService } from '../../../../workbench/contrib/notebook/common/notebookLoggingService.js';
import { NotebookLoggingService } from '../../../../workbench/contrib/notebook/browser/services/notebookLoggingServiceImpl.js';
import { INotebookCellOutlineDataSourceFactory, NotebookCellOutlineDataSourceFactory } from '../../../../workbench/contrib/notebook/browser/viewModel/notebookOutlineDataSourceFactory.js';
import { INotebookOutlineEntryFactory, NotebookOutlineEntryFactory } from '../../../../workbench/contrib/notebook/browser/viewModel/notebookOutlineEntryFactory.js';
import { IInteractiveDocumentService, InteractiveDocumentService } from '../../../../workbench/contrib/interactive/browser/interactiveDocumentService.js';
import { IInteractiveHistoryService, InteractiveHistoryService } from '../../../../workbench/contrib/interactive/browser/interactiveHistoryService.js';

// Chat attachments/editing and the original Extension Host API depend on these services.
// Keep their original delayed implementations without notebook/interactive/REPL editor registrations.
// A delayed descriptor does not imply that its implementation module was not evaluated.
registerSingleton(INotebookService, NotebookService, InstantiationType.Delayed);
registerSingleton(INotebookEditorWorkerService, NotebookEditorWorkerServiceImpl, InstantiationType.Delayed);
registerSingleton(INotebookEditorModelResolverService, NotebookModelResolverServiceImpl, InstantiationType.Delayed);
registerSingleton(INotebookCellStatusBarService, NotebookCellStatusBarService, InstantiationType.Delayed);
registerSingleton(INotebookEditorService, NotebookEditorWidgetService, InstantiationType.Delayed);
registerSingleton(INotebookKernelService, NotebookKernelService, InstantiationType.Delayed);
registerSingleton(INotebookKernelHistoryService, NotebookKernelHistoryService, InstantiationType.Delayed);
registerSingleton(INotebookExecutionService, NotebookExecutionService, InstantiationType.Delayed);
registerSingleton(INotebookExecutionStateService, NotebookExecutionStateService, InstantiationType.Delayed);
registerSingleton(INotebookRendererMessagingService, NotebookRendererMessagingService, InstantiationType.Delayed);
registerSingleton(INotebookKeymapService, NotebookKeymapService, InstantiationType.Delayed);
registerSingleton(INotebookLoggingService, NotebookLoggingService, InstantiationType.Delayed);
registerSingleton(INotebookCellOutlineDataSourceFactory, NotebookCellOutlineDataSourceFactory, InstantiationType.Delayed);
registerSingleton(INotebookOutlineEntryFactory, NotebookOutlineEntryFactory, InstantiationType.Delayed);
registerSingleton(IInteractiveDocumentService, InteractiveDocumentService, InstantiationType.Delayed);
registerSingleton(IInteractiveHistoryService, InteractiveHistoryService, InstantiationType.Delayed);
