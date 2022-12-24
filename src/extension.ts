import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const COMMAND_ID = 'multisrc.pickSourceFolder';

let statusBarItem: vscode.StatusBarItem;
let workspace: vscode.WorkspaceFolder;
let currentFolder: string;

let config = {
	sourcesFolder: "sources",
	sourceLink: ".src",
	projectFileRegex: "",
	projectChangeCommand: "",
	configFilePath: "",
	configFileTemplate: "",
}

async function getCurrentProject() {
	try {
		let linkPath = await fs.promises.readlink(path.join(workspace.uri.fsPath, config.sourceLink))
		let absolutePath = path.resolve(path.dirname(path.join(workspace.uri.fsPath, config.sourceLink)), linkPath)
		let projectPath = path.relative(path.join(workspace.uri.fsPath, config.sourcesFolder), absolutePath)
		
		return projectPath

	} catch (err) {
		return undefined
	}
}

async function getProjectFolders() {
	let root = path.join(workspace.uri.fsPath, config.sourcesFolder)
	let folders = (await fs.promises.readdir(root, { withFileTypes: true }))
		.filter(entry => entry.isDirectory())
		.map(folder => folder.name)

	if (!config.projectFileRegex) return folders
	
	let projects = []

	while (folders.length > 0) {
		let folder = folders.shift()
		let entries = (await fs.promises.readdir(path.join(root, folder), { withFileTypes: true }))
		let file = entries.find(file => file.name.match(config.projectFileRegex))
		if (file !== undefined) {
			projects.push(folder)
			continue
		}

		folders.push(...(entries.filter(entry => entry.isDirectory()).map(subfolder => path.join(folder, subfolder.name))))
	}

	return projects.sort();
}

async function pickSourceFolder() {
	let options = getProjectFolders()

	return await vscode.window.showQuickPick(
		options,
		{
			placeHolder: 'Select a source project to use:',
		})
}

async function removeLink() {
	let linkPath = path.join(workspace.uri.fsPath, config.sourceLink)
	let stats = await fs.promises.lstat(linkPath)
	if (stats.isSymbolicLink()) {
		await fs.promises.unlink(linkPath)
	}
}

export function activate(context: vscode.ExtensionContext) {

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = COMMAND_ID;
	statusBarItem.tooltip = "Multi-Sourced Project"
	context.subscriptions.push(statusBarItem)

	vscode.workspace.onDidChangeWorkspaceFolders(event => {
		activateIfNeeded()
	})

	activateIfNeeded()

	context.subscriptions.push(vscode.commands.registerCommand(COMMAND_ID, async () => {
		const result = await pickSourceFolder()

		if (result === undefined) return

		try {
			await removeLink()
			await fs.promises.symlink(path.join(config.sourcesFolder, result), path.join(workspace.uri.fsPath, config.sourceLink), 'junction')
			
			if (config.configFilePath) {
				await fs.promises.writeFile(path.resolve(workspace.uri.fsPath, config.configFilePath), config.configFileTemplate.replace(/\{project\}/g, path.join(config.sourcesFolder, result)))	
			}

			statusBarItem.text = `< ${result} >`
			currentFolder = path.join(workspace.uri.fsPath, config.sourcesFolder, result)
			checkCurrentEditor()
			vscode.workspace.saveAll(false)
			vscode.commands.executeCommand("workbench.files.action.refreshFilesExplorer") // workbench.action.reloadWindow
			if (config.projectChangeCommand) vscode.commands.executeCommand(config.projectChangeCommand)
		} catch (err) {
			statusBarItem.text = "< Error! >"
			console.error(err)
		}
	}));
	checkCurrentEditor()
	vscode.window.onDidChangeActiveTextEditor(checkCurrentEditor)
}

async function activateIfNeeded() {
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

	try {
		let configData = await fs.promises.readFile(path.join(workspace.uri.fsPath, '.multisrc'))

		try {
			Object.assign(config, JSON.parse(configData.toString()))
		} catch (error) {
			vscode.window.showErrorMessage(error)
		}

		let project = await getCurrentProject()
		statusBarItem.text = `< ${project ?? 'Not Set'} >`
		currentFolder = project ? path.join(workspace.uri.fsPath, config.sourcesFolder, project) : undefined
		statusBarItem.show()

		if (project) {
			if (config.configFilePath) {
				await fs.promises.writeFile(path.resolve(workspace.uri.fsPath, config.configFilePath), config.configFileTemplate.replace(/\{project\}/g, path.join(config.sourcesFolder, project)))
			}
		}

	} catch (err) {
		console.warn(err)
	}
}

function checkCurrentEditor(editor?: vscode.TextEditor) {
	editor = editor || vscode.window.activeTextEditor;
	statusBarItem.backgroundColor = editor && editor.document && editor.document.uri.fsPath.startsWith(currentFolder) 
		? undefined 
		: new vscode.ThemeColor('statusBarItem.errorBackground')
}

// this method is called when your extension is deactivated
export function deactivate() {
	statusBarItem.hide()
}
