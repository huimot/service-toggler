import Gdk from "gi://Gdk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import {gettext as _} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
const UUID = "wireguard-indicator@atareao.es";
import * as Widgets from "./preferenceswidget.js";
import * as Config from "resource:///org/gnome/Shell/Extensions/js/misc/config.js";

export const AboutPage = GObject.registerClass(
    {
        GTypeName: (UUID + '.AboutPage').replace(/[\W_]+/g,'_')
    },
    class AboutPage extends Widgets.Page{
        _init(ext){ this.ext = ext;
            super._init();
            this.addLocalImage(this.ext.metadata.icon, 100);
            const appName = this.ext.metadata.name;
            this.addLabel(`<span size="large"><b>${appName}</b></span>`);
            this.addLabel(this.ext.metadata.description);

            this.addFrame(null, this._getInfoFrame());
            this.addFrame(null, this._getInfoNotebook());
            this.addLinkButton("bmc-button", 150,
                               "https://www.buymeacoffee.com/atareao",
                               _("Buy me a coffee"));
        }

        _getInfoFrame(){
            const info = new Widgets.Frame();
            info.addLabelRow(this.ext.metadata.name + " " + _('Version'),
                             this.ext.metadata.version.toString());
            info.addLabelRow(_("GNOME Version"),
                             Config.PACKAGE_VERSION.toString());
            info.addLabelRow(_("OS"), this._getOS());
            info.addLabelRow(_("SessionType"), this._getSessionType());
            return info;
        }
        _getInfoNotebook(){
            const infoScrolledWindow = new Gtk.ScrolledWindow({
                marginTop: 10,
                maxContentHeight: 250,
                minContentHeight: 250,
                vexpand: false,
            });
            const notebook = new Widgets.Notebook();
            infoScrolledWindow.set_child(notebook);
            notebook.append_page(this._getDevelopersPage());
            notebook.append_page(this._getContributorsPage());
            notebook.append_page(this._getSupportersPage());
            notebook.append_page(this._getLicensePage());
            notebook.append_page(this._getDoing());
            return infoScrolledWindow;
        }
        _getNotebookPage(title, content){
            const page = new Widgets.NotebookPage(title);
            const label = new Gtk.Label({
                label: content,
                use_markup: true,
                halign: Gtk.Align.START,
                hexpand: false,
                vexpand: false
            });
            page.append(label);
            return page;
        }
        _getDevelopersPage(){
            const title = _("Developers");
            const content = `
<b>Lorenzo Carbonell</b> a.k.a <a href="https://atareao.es">@atareao</a>"
`;
            return this._getNotebookPage(title, content);
        }
        _getContributorsPage(){
            const title = _("Contributors");
            const thanks = _("Thank you to all contributors!");
            const visit = _("For a list of all contributors, please visit");
            const url = this.ext.metadata.url;
            const name = this.ext.metadata.name;
            const content = `
<b>${thanks}</b>
${visit} <a href="${url}">${name}</a>`;
            return this._getNotebookPage(title, content);
        }
        _getSupportersPage(){
            const title = _("Supporters");
            const thanks = _("Thank you to all supporters!");
            const visit = _("For a list of all supporters, please visit");
            const content = `
<b>${thanks}</b>
${visit} <a href="https://atareao.es/supporters">Supporters</a>`;
            return this._getNotebookPage(title, content);
        }
        _getLicensePage(){
            const title = _("License");
            const content = `<small>
THE SOFTWARE IS PROVIDED AS IS, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE
</small>`;
            return this._getNotebookPage(title, content);
        }
        _getDoing(){
            const page = new Widgets.NotebookPage(_("More info"));
            const box = new Gtk.Box({
                marginStart: 24,
                marginEnd: 24,
                orientation: Gtk.Orientation.HORIZONTAL,
                halign: Gtk.Align.CENTER
            });
            const ghurl = this.ext.metadata.description;
            const ghissue = `${ghurl}/issues`;
            
            const moreinfo = _("More information");
            page.appendImageWithLabel(
                "info", 24, `<a href="${ghurl}">${moreinfo}</a>`);
            const issue = _("Report an issue");
            page.appendImageWithLabel(
                "bug", 24, `<a href="${ghissue}">${issue}</a>`);

            box.append(this._getLinkButton(
                "youtube", 48, "https://atareao.es/youtube", "YouTube"));
            box.append(this._getLinkButton(
                "spotify", 48, "https://atareao.es/spotify", "Spotify"));
            box.append(this._getLinkButton(
                "github", 48, "https://atareao.es/github", "GitHub"));
            box.append(this._getLinkButton(
                "twitter", 48, "https://atareao.es/twitter", "Twitter"));
            box.append(this._getLinkButton(
                "mastodon", 48, "https://atareao.es/mastodon", "Mastodon"));
            box.append(this._getLinkButton(
                "telegram", 48, "https://atareao.es/telegram", "Telegram"));
            box.append(this._getLinkButton(
                "atareao", 48, "https://atareao.es", "atareao.es"));
            page.append(box);
            return page;
        }

        _getLinkButton(iconName, pixelSize, uri, tooltip){
            const baseIcon = this.ext.path + '/icons/' + iconName;
            let fileIcon = Gio.File.new_for_path(baseIcon + '.png')
            if(fileIcon.query_exists(null) == false){
                fileIcon = Gio.File.new_for_path(baseIcon + '.svg')
            }
            if(fileIcon.query_exists(null)){
                const picture = new Gtk.Image({
                    marginTop: 15,
                    marginBottom: 15,
                    file: fileIcon.get_path(),
                    pixelSize: pixelSize,
                    vexpand: false
                });
                const linkButton = new Gtk.LinkButton({
                    hexpand: false,
                    vexpand: false,
                    valign: Gtk.Align.CENTER,
                    halign: Gtk.Align.CENTER,
                    child: picture,
                    uri: uri,
                    tooltip_text: tooltip
                });
                return linkButton;
            }
        }

        _getOS(){
            let prettyName;
            let osName;
            let versionID;
            let buildID;
            if((prettyName = GLib.get_os_info("PRETTY_NAME"))){
                osName = prettyName;
            }else{
                osName = GLib.get_os_info("NAME");
            }
            if((versionID = GLib.get_os_info("VERSION_ID"))){
                osName += `; Version ID: ${versionID}`;
            }
            if((buildID = GLib.get_os_info("BUILD_ID"))){
                osName += `; Build ID: ${buildID}`;
            }
            return osName;
        }

        _getSessionType(){
            return this.ext.metadata.isWayLand?"Wayland":"X11";
        }


    }
);

