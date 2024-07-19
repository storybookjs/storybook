import path from "node:path";
import { findUpSync } from "find-up";

export const getProjectRoot = () => {
	let result: string | undefined = undefined;

	try {
		const found = findUpSync(".git", { type: "directory" });
		if (found) {
			result = path.join(found, "..");
		}
	} catch (e) {
		//
	}

	try {
		const found = findUpSync(".svn", { type: "directory" });
		if (found) {
			result = result || path.join(found, "..");
		}
	} catch (e) {
		//
	}

	try {
		const found = findUpSync(".hg", { type: "directory" });
		if (found) {
			result = result || path.join(found, "..");
		}
	} catch (e) {
		//
	}

	try {
		const splitDirname = __dirname.split("node_modules");
		result = result || (splitDirname.length >= 2 ? splitDirname[0] : undefined);
	} catch (e) {
		//
	}

	try {
		const found = findUpSync(".yarn", { type: "directory" });
		if (found) {
			result = result || path.join(found, "..");
		}
	} catch (e) {
		//
	}

	return result || process.cwd();
};
