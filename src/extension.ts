// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let myStatusBarItem: vscode.StatusBarItem;
const myCommandId = 'multisrc.helloWorld';
var workspace: vscode.WorkspaceFolder
var config = {
	sources_dir: "sources",
	src_dir: ".src"
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    myStatusBarItem.command = myCommandId;
    myStatusBarItem.tooltip = "Multi-Sourced Project"
    
    context.subscriptions.push(myStatusBarItem);
	console.log("I'm HERE!")

	vscode.workspace.onDidChangeWorkspaceFolders(event => {
		activateIfNeeded()
	})

	activateIfNeeded()

	context.subscriptions.push(vscode.commands.registerCommand('multisrc.helloWorld', async () => {
		const result = await vscode.window.showQuickPick(
			fs.readdirSync(workspace.uri.fsPath + "/" + config.sources_dir),
			{
				placeHolder: 'Select a source folder to use:',
			});

		fs.unlink(workspace.uri.fsPath + "/" + config.src_dir, (err) => {
			if (err && err.code !== "ENOENT") {
				myStatusBarItem.text = "< Error! >";
				console.error(err)
			} else {
				fs.symlink("./" + config.sources_dir + "/" + result, workspace.uri.fsPath + "/" + config.src_dir, (err) => {
					if (err) {
						myStatusBarItem.text = "< Error! >";
						console.error(err)
					} else {
						myStatusBarItem.text = `< ${result} >`
					}
					vscode.workspace.saveAll(false)
					vscode.commands.executeCommand("workbench.files.action.refreshFilesExplorer") // workbench.action.reloadWindow
				})
			}
		})
	}));
}

function activateIfNeeded() {
	if (!vscode.workspace.workspaceFolders) {
		//myStatusBarItem.text = "No workspaces found!"
		myStatusBarItem.hide()
		return
	}

	workspace = vscode.workspace.workspaceFolders!.find(folder =>
		fs.existsSync(folder.uri.fsPath + "/.multisrc")
	);

	if (!workspace) {
		//myStatusBarItem.text = "No .multisrc found!"
		myStatusBarItem.hide()
		return
	}

	fs.readFile(workspace.uri.fsPath + "/.multisrc", async (err, data) => {
		if (err) {
			console.warn(err)
			return
		}

		try {
			Object.assign(config, JSON.parse(data.toString()))
		} catch (error) {
			vscode.window.showErrorMessage(error)
		}

		fs.readlink(workspace.uri.fsPath + "/" + config.src_dir, (err, data) => {
			if (err) {
				myStatusBarItem.text = "< Error >";
			} else {
				myStatusBarItem.text = `< ${path.basename(data)} >`
			}
			myStatusBarItem.show();
		})
	})
}

// this method is called when your extension is deactivated
export function deactivate() {
	myStatusBarItem.hide()
}
