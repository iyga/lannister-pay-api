import {
  ComputeTransactionFeeResponse,
  QueryComputeTransactionFeeArgs,
} from '../../types/resolvers-types';
import {computeAppliedFeeValue, computeChargeAmount} from '../../utils';
import {isEmpty, sortBy} from 'lodash';

import {ContextValue} from '../../types';
import {UserInputError} from 'apollo-server-errors';

export const computeTransactionFee = async (
  _root: unknown,
  args: QueryComputeTransactionFeeArgs,
  context: ContextValue
): Promise<ComputeTransactionFeeResponse> => {
  try {
    // context.dataSources.fees.initialize();
    // ensure fee specification exists
    const feeSpecDocCount = await context.dataSources.fees?.countDocuments();
    if (feeSpecDocCount === 0)
      throw new UserInputError('Call /fee endpoint first');

    const locale =
      args.CurrencyCountry === args.PaymentEntity.Country ? 'LOCL' : 'INTL';

    const fields = {
      'entity.feeEntity': {$in: [args.PaymentEntity.Type, '*']},
      'entity.entityProperty': {
        $in: [
          args.PaymentEntity.Brand,
          args.PaymentEntity.Issuer,
          args.PaymentEntity.Number,
          args.PaymentEntity.SixID,
          args.PaymentEntity.ID,
          '*',
        ],
      },
      feeLocale: {$in: [locale, '*']},
      feeCurrency: {$in: [args.Currency, '*']},
    };

    const feeSpecDoc = await context.dataSources.fees?.find(fields);

    if (isEmpty(feeSpecDoc))
      throw new UserInputError('No fee configuration for this transaction');

    // sort in ascending order of specificity weight
    const sortedSpecDoc = sortBy(feeSpecDoc, item => item.specificityCount);

    // select the most apt configuration to apply based on its precedence
    const feeSpec = sortedSpecDoc[sortedSpecDoc.length - 1];

    // TODO: applied value is expected to be of type number
    const appliedFeeValue = computeAppliedFeeValue(
      feeSpec.feeValue,
      args.Amount
    );

    const chargeAmount = computeChargeAmount(
      args.Customer.BearsFee,
      args.Amount,
      appliedFeeValue
    );

    // SettlementAmount = ChargeAmount - AppliedFeeValue
    const settlementAmount = chargeAmount - Number(appliedFeeValue);

    const result = {
      AppliedFeeID: feeSpec.feeID,
      AppliedFeeValue: Number(appliedFeeValue),
      ChargeAmount: chargeAmount,
      SettlementAmount: settlementAmount,
    };

    return {
      code: 200,
      success: true,
      message: 'Successfully applied configuration fee',
      ...result,
    };
  } catch (error: unknown) {
    console.error('xxxx Compute Transaction Fees: Error Message:', error);
    //   if (error instanceof ApolloError) {
    //     return {
    //       code: '500',
    //       success: false,
    //       message: error.message,
    //     };
    //   } else {
    //     return {
    //       code: '501',
    //       success: false,
    //       message: 'FATAL ERROR: Error is not an instance of ApolloError',
    //     };
    //   }

    // rethrow for use in REST API
    throw error;
  }
};
