/* eslint-disable react/no-multi-comp */
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';

import CappedCollectionFields from './capped-collection-fields';
import CollectionName from './collection-name';
import DatabaseName from './database-name';
import hasTimeSeriesSupport from './has-time-series-support';
import TimeSeriesFields from './time-series-fields';
import Collation from './collation';

function asNumber(value) {
  return `${value}` ? +value : undefined;
}

export default class CollectionFields extends PureComponent {
  static propTypes = {
    onChange: PropTypes.func.isRequired,
    openLink: PropTypes.func.isRequired,
    serverVersion: PropTypes.string,
    withDatabase: PropTypes.bool
  }

  state = {
    isCapped: false,
    isCustomCollation: false,
    isTimeSeries: false,
    fields: {
      cappedSize: '',
      collation: {},
      collectionName: '',
      databaseName: '',
      timeSeries: {}
    }
  };

  setField(fieldName, value) {
    const fields = _.cloneDeep(this.state.fields);
    _.set(fields, fieldName, Object.is(value, NaN) ? undefined : value);
    this.setState({ fields }, this.updateOptions);
  }

  updateOptions = () => {
    this.props.onChange({
      database: this.state.fields.databaseName,
      collection: this.state.fields.collectionName,
      options: this.buildOptions()
    });
  }

  buildOptions() {
    const state = this.state;
    const cappedOptions = state.isCapped ? {
      capped: true,
      size: state.fields.cappedSize ? state.fields.cappedSize : undefined
    } : {};

    const collationOptions = state.isCustomCollation ? {
      collation: state.fields.collation
    } : {};

    const timeSeriesOptions = state.isTimeSeries ? {
      timeseries: state.fields.timeSeries
    } : {};

    return {
      ...collationOptions,
      ...cappedOptions,
      ...timeSeriesOptions
    };
  }

  render() {
    const {
      openLink,
      serverVersion,
      withDatabase
    } = this.props;

    const {
      fields,
      isCapped,
      isCustomCollation,
      isTimeSeries
    } = this.state;

    const {
      collectionName,
      databaseName,
      cappedSize,
      collation,
      timeSeries
    } = fields;

    return (<>
      {withDatabase && (
        <DatabaseName
          databaseName={databaseName}
          onChangeDatabaseName={
            (newDatabaseName) => this.setField('databaseName', newDatabaseName)
          }
        />
      )}
      <CollectionName
        collectionName={collectionName}
        onChangeCollectionName={(newCollectionName) => this.setField(
          'collectionName',
          newCollectionName
        )}
      />
      <CappedCollectionFields
        cappedSize={`${cappedSize}`}
        isCapped={isCapped}
        onChangeCappedSize={(newCappedSizeString) => this.setField(
          'cappedSize',
          asNumber(newCappedSizeString)
        )}
        onChangeIsCapped={
          (capped) => this.setState({ isCapped: capped }, this.updateOptions)
        }
        openLink={openLink}
      />
      <Collation
        collation={collation}
        onChangeCollationOption={(fieldName, value) => {
          this.setField(`collation.${fieldName}`, value);
        }}
        onChangeIsCustomCollation={(customCollation) => this.setState(
          { isCustomCollation: customCollation },
          this.updateOptions
        )}
        isCustomCollation={isCustomCollation}
        openLink={openLink}
      />
      {hasTimeSeriesSupport(serverVersion) && (
        <TimeSeriesFields
          isTimeSeries={isTimeSeries}
          onChangeIsTimeSeries={(newIsTimeSeries) => this.setState(
            { isTimeSeries: newIsTimeSeries },
            this.updateOptions
          )}
          onChangeTimeSeriesField={(fieldName, value) => this.setField(
            `timeSeries.${fieldName}`, value
          )}
          timeSeries={timeSeries}
        />
      )}
    </>);
  }
}