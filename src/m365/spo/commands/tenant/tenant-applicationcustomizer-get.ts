import { Logger } from '../../../../cli/Logger.js';
import GlobalOptions from '../../../../GlobalOptions.js';
import { formatting } from '../../../../utils/formatting.js';
import { odata } from '../../../../utils/odata.js';
import { spo } from '../../../../utils/spo.js';
import { urlUtil } from '../../../../utils/urlUtil.js';
import { validation } from '../../../../utils/validation.js';
import SpoCommand from '../../../base/SpoCommand.js';
import commands from '../../commands.js';
import { Cli } from '../../../../cli/Cli.js';
import { ListItemInstance } from '../listitem/ListItemInstance.js';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  title?: string;
  id?: string;
  clientSideComponentId?: string;
}

class SpoTenantApplicationCustomizerGetCommand extends SpoCommand {
  public get name(): string {
    return commands.TENANT_APPLICATIONCUSTOMIZER_GET;
  }

  public get description(): string {
    return 'Get an application customizer that is installed tenant wide';
  }

  constructor() {
    super();

    this.#initTelemetry();
    this.#initOptions();
    this.#initValidators();
    this.#initOptionSets();
  }

  #initTelemetry(): void {
    this.telemetry.push((args: CommandArgs) => {
      Object.assign(this.telemetryProperties, {
        title: typeof args.options.title !== 'undefined',
        id: typeof args.options.id !== 'undefined',
        clientSideComponentId: typeof args.options.clientSideComponentId !== 'undefined'
      });
    });
  }

  #initOptions(): void {
    this.options.unshift(
      {
        option: '-t, --title [title]'
      },
      {
        option: '-i, --id [id]'
      },
      {
        option: '-c, --clientSideComponentId [clientSideComponentId]'
      }
    );
  }

  #initValidators(): void {
    this.validators.push(
      async (args: CommandArgs) => {
        if (args.options.id && isNaN(parseInt(args.options.id))) {
          return `${args.options.id} is not a number`;
        }

        if (args.options.clientSideComponentId && !validation.isValidGuid(args.options.clientSideComponentId)) {
          return `${args.options.clientSideComponentId} is not a valid GUID`;
        }

        return true;
      }
    );
  }

  #initOptionSets(): void {
    this.optionSets.push({ options: ['title', 'id', 'clientSideComponentId'] });
  }

  public async commandAction(logger: Logger, args: CommandArgs): Promise<void> {
    try {
      const appCatalogUrl = await spo.getTenantAppCatalogUrl(logger, this.debug);

      if (!appCatalogUrl) {
        throw 'No app catalog URL found';
      }

      let filter: string;
      if (args.options.title) {
        filter = `Title eq '${args.options.title}'`;
      }
      else if (args.options.id) {
        filter = `Id eq '${args.options.id}'`;
      }
      else {
        filter = `TenantWideExtensionComponentId eq '${args.options.clientSideComponentId}'`;
      }

      const listServerRelativeUrl: string = urlUtil.getServerRelativePath(appCatalogUrl, '/lists/TenantWideExtensions');
      const listItemInstances = await odata.getAllItems<ListItemInstance>(`${appCatalogUrl}/_api/web/GetList('${formatting.encodeQueryParameter(listServerRelativeUrl)}')/items?$filter=TenantWideExtensionLocation eq 'ClientSideExtension.ApplicationCustomizer' and ${filter}`);

      if (listItemInstances) {
        if (listItemInstances.length === 0) {
          throw 'The specified application customizer was not found';
        }

        listItemInstances.forEach(v => delete (v as any)['ID']);

        if (listItemInstances.length > 1) {
          const resultAsKeyValuePair = formatting.convertArrayToHashTable('Id', listItemInstances);
          const result = await Cli.handleMultipleResultsFound<ListItemInstance>(`Multiple application customizers with ${args.options.title || args.options.clientSideComponentId} were found.`, resultAsKeyValuePair);
          await logger.log(result);
        }
        else {
          await logger.log(listItemInstances[0]);
        }
      }
      else {
        throw 'The specified application customizer was not found';
      }
    }
    catch (err: any) {
      return this.handleRejectedODataJsonPromise(err);
    }
  }
}

export default new SpoTenantApplicationCustomizerGetCommand();