/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
export function Icon({ name }: { name: string }) {
	return <span aria-hidden="true" className={'codicon codicon-' + name}/>;
}
