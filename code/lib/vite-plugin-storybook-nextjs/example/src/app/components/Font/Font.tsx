/* eslint-disable react/prop-types */
import { Comic_Neue } from "next/font/google";
import localFont from "next/font/local";

import React from "react";

const comicNeue = Comic_Neue({
	subsets: ["latin"],
	variable: "--font-comic-neue",
	weight: ["700"],
});

export const localRubikStorm = localFont({
	src: "/fonts/RubikStorm-Regular.ttf",
	variable: "--font-rubik-storm",
});

type FontProps = {
	variant: "className" | "style" | "variable";
};

export default function Font({ variant }: FontProps) {
	switch (variant) {
		case "className":
			return (
				<div>
					<h1 className={comicNeue.className}>Google Comic Neue</h1>
					<h1 className={localRubikStorm.className}>Local Rubik Storm</h1>
				</div>
			);
		case "style":
			return (
				<div>
					<h1 style={comicNeue.style}>Google Comic Neue</h1>
					<h1 style={localRubikStorm.style}>Local Rubik Storm</h1>
				</div>
			);
		case "variable":
			return (
				<div>
					<div className={comicNeue.variable}>
						<h1
							style={{
								fontFamily: "var(--font-comic-neue)",
								fontStyle: comicNeue.style.fontStyle,
								fontWeight: comicNeue.style.fontWeight,
							}}
						>
							Google Comic Neue
						</h1>
					</div>
					<div className={localRubikStorm.variable}>
						<h1
							style={{
								fontFamily: "var(--font-rubik-storm)",
								fontStyle: localRubikStorm.style.fontStyle,
								fontWeight: localRubikStorm.style.fontWeight,
							}}
						>
							Local Rubik Storm
						</h1>
					</div>
				</div>
			);
		default:
			return null;
	}
}
