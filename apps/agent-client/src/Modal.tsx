/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import { useEffect, useRef, type ReactNode } from 'react';

/** Native dialog supplies focus containment, Escape handling and focus restoration. */
export function Modal({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
	const element = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const previous = document.activeElement;
		element.current?.showModal();
		return () => { if (previous instanceof HTMLElement && previous.isConnected) { previous.focus(); } };
	}, []);
	return <dialog ref={element} className="dialog" aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}>
		<h2>{title}</h2>{children}
	</dialog>;
}
