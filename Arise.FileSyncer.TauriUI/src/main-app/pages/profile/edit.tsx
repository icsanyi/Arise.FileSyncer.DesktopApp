import React from "react"
import AppData from "../../../app-data/app-data"
import { invoke } from "@tauri-apps/api/tauri"
import { listen, UnlistenFn, Event } from "@tauri-apps/api/event"
import { PageTitleBar } from "../../../components/page-title-bar"
import { Button } from "../../../components/button"
import { goBack } from "../../page-controller"
import { pushNotification } from "../../notification-manager"
import { ProfileEditor, handleTextBoxChange, handleCheckBoxChange, handleDirectorySelected, checkEditorState } from "../../../components/editor"
import { EditProfileResult, EditProfile } from "../../../ipc/messages"

export interface EditProfilePageProps {
    id: string,
}

interface EditProfilePageState {
    waiting: boolean,

    name: string,
    rootDir: string,
    allowSend: boolean,
    allowReceive: boolean,
    allowDelete: boolean,
    skipHidden: boolean,

    eventUnlisten: UnlistenFn | null,
}

export class EditProfilePage extends React.Component<EditProfilePageProps, EditProfilePageState> {
    private handleTextBoxChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    private handleCheckBoxChange: (name: string) => void;
    private handleDirectorySelected: (path: string) => void;

    private profileName: string;
    private waiting = false;

    constructor(props: EditProfilePageProps) {
        super(props)

        const profile = AppData.profiles.get(this.props.id)
        this.profileName = profile.name

        this.state = {
            waiting: false,
            name: profile.name,
            rootDir: profile.rootDirectory,
            allowSend: profile.allowSend,
            allowReceive: profile.allowReceive,
            allowDelete: profile.allowDelete,
            skipHidden: profile.skipHidden,
            eventUnlisten: null
        }

        this.handleTextBoxChange = handleTextBoxChange.bind(this)
        this.handleCheckBoxChange = handleCheckBoxChange.bind(this)
        this.handleDirectorySelected = handleDirectorySelected.bind(this)

        this.onSave = this.onSave.bind(this)
        this.onResult = this.onResult.bind(this)
    }

    public async componentDidMount() {
        this.setState({ eventUnlisten: await listen("srvEditProfileResult", this.onResult) })
    }

    public componentWillUnmount() {
        if (this.state.eventUnlisten != null) {
            //this.state.eventUnlisten()
        }

        this.setState({ eventUnlisten: null })
    }

    public render() {
        return (
            <div className="base-page">
                <PageTitleBar useMini={false} title={"Editing profile: " + this.profileName}>
                    <Button style="blue" className="page-title-bar-button" onClick={this.onSave} disabled={this.state.waiting}>Save Changes</Button>
                </PageTitleBar>
                <ProfileEditor disable={this.state.waiting} disableSH={true} name={this.state.name} rootDir={this.state.rootDir}
                    allowSend={this.state.allowSend} allowReceive={this.state.allowReceive} allowDelete={this.state.allowDelete} skipHidden={this.state.skipHidden}
                    onTextBoxChange={this.handleTextBoxChange} onCheckBoxChange={this.handleCheckBoxChange} onDirectorySelected={this.handleDirectorySelected} />
            </div >
        )
    }

    private onSave() {
        if (this.waiting) {
            return
        }

        this.waiting = true
        this.setState({ waiting: true })

        if (checkEditorState(this)) {
            const profileData: EditProfile.Data = {
                Id: this.props.id,
                Name: this.state.name,
                RootDirectory: this.state.rootDir,
                AllowSend: this.state.allowSend,
                AllowReceive: this.state.allowReceive,
                AllowDelete: this.state.allowDelete
            }

            invoke("edit_profile", { profileData })
        } else {
            // TODO: better message or no message but show incorrect fields
            pushNotification({
                type: "error",
                text: "Failed to update profile: Requirements not fulfilled",
                time: 3000
            })

            this.waiting = false
            this.setState({ waiting: false })
        }
    }

    private onResult(e:Event<EditProfileResult.Message>) {
        if (e.payload.Success) {
            pushNotification({
                type: "success",
                text: "Profile \"" + this.profileName + "\" has been updated",
                time: 3000
            })

            goBack()
        } else {
            this.waiting = false
            this.setState({ waiting: false })

            pushNotification({
                type: "error",
                text: "Failed to update profile: Unknown error",
                time: 5000
            })
        }
    }
}
