import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const COMMAND_ID = 'multisrc.pickSourceFolder';

let statusBarItem: vscode.StatusBarItem;
let workspace: vscode.WorkspaceFolder;
let currentFolder: string;

let config = {
	sourcesFolder: "sources",
	sourceLink: ".src"
}

async function pickSourceFolder() {
	let folders = fs.readdirSync(path.join(workspace.uri.fsPath, config.sourcesFolder), { withFileTypes: true });
	console.log(folders);
	let options = folders.filter(folder => folder.isDirectory()).map(folder => folder.name);
	console.log(options);

	return await vscode.window.showQuickPick(
		options,
		{
			placeHolder: 'Select a source folder to use:',
		});
}

export function activate(context: vscode.ExtensionContext) {

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = COMMAND_ID;
	statusBarItem.tooltip = "Multi-Sourced Project"
	context.subscriptions.push(statusBarItem);

	vscode.workspace.onDidChangeWorkspaceFolders(event => {
		activateIfNeeded()
	})

	activateIfNeeded()

	context.subscriptions.push(vscode.commands.registerCommand(COMMAND_ID, async () => {
		const result = await pickSourceFolder();

		if (result === undefined) return;

		fs.unlink(path.join(workspace.uri.fsPath, config.sourceLink), (err) => {
			if (err && err.code !== "ENOENT") {
				statusBarItem.text = "< Error! >";
				console.error(err)
			} else {
				fs.symlink(path.join('.', config.sourcesFolder, result), path.join(workspace.uri.fsPath, config.sourceLink), 'junction', (err) => {
					if (err) {
						statusBarItem.text = "< Error! >";
						console.error(err)
					} else {
						statusBarItem.text = `< ${result} >`
						currentFolder = path.join(workspace.uri.fsPath, config.sourcesFolder, result);
						checkCurrentEditor();
					}
					vscode.workspace.saveAll(false)
					vscode.commands.executeCommand("workbench.files.action.refreshFilesExplorer") // workbench.action.reloadWindow
				})
			}
		})
	}));
	checkCurrentEditor();
	vscode.window.onDidChangeActiveTextEditor(checkCurrentEditor);
}

function activateIfNeeded() {
	if (!vscode.workspace.workspaceFolders) {
		statusBarItem.hide()
		return
	}

	workspace = vscode.workspace.workspaceFolders!.find(folder =>
		fs.existsSync(path.join(folder.uri.fsPath, '.multisrc'))
	);

	if (!workspace) {
		statusBarItem.hide()
		return
	}

	fs.readFile(path.join(workspace.uri.fsPath, '.multisrc'), async (err, data) => {
		if (err) {
			console.warn(err)
			return
		}

		try {
			Object.assign(config, JSON.parse(data.toString()))
		} catch (error) {
			vscode.window.showErrorMessage(error)
		}

		fs.readlink(path.join(workspace.uri.fsPath, config.sourceLink), (err, data) => {
			if (err) {
				statusBarItem.text = "< Not Set >";
			} else {
				statusBarItem.text = `< ${path.basename(data)} >`
				currentFolder = path.join(workspace.uri.fsPath, config.sourcesFolder, path.basename(data));
			}
			statusBarItem.show();
		})
	})
}

function checkCurrentEditor(editor?: vscode.TextEditor) {
	editor = editor || vscode.window.activeTextEditor;
	statusBarItem.backgroundColor = editor && editor.document && editor.document.uri.fsPath.startsWith(currentFolder) 
		? undefined 
		: new vscode.ThemeColor('statusBarItem.errorBackground');
}

// this method is called when your extension is deactivated
export function deactivate() {
	statusBarItem.hide()
}
